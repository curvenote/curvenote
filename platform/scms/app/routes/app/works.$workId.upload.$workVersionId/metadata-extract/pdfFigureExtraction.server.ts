/**
 * Fast PDF figure extraction for phase-B thumbnail candidates.
 *
 * Scans a capped page range with pdfjs directly (no full officeparser pass).
 * Intended as a first pass — may miss figures on later pages or exotic encodings.
 */

import type { OfficeAttachment } from 'officeparser';
import { loadPdfJs } from './pdfJsUtils.server';

/** First-pass page scan limit for PDF figure extraction. */
export const PDF_FIGURE_MAX_PAGES = 32;

/** Skip tiny raster objects (icons, bullets, decoration). */
export const PDF_FIGURE_MIN_EDGE_PX = 32;

/** Skip oversized rasters before RGBA/BMP materialization (downscale happens later). */
export const PDF_FIGURE_MAX_EDGE_PX = 2048;

export const PDF_FIGURE_MAX_PIXELS = PDF_FIGURE_MAX_EDGE_PX * PDF_FIGURE_MAX_EDGE_PX;

const PDF_IMAGE_RESOLVE_TIMEOUT_MS = 500;

interface PdfImageObject {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  kind: number;
}

function convertToRgbaBuffer(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  kind: number,
): Buffer {
  let rgbaData: Uint8ClampedArray;
  if (kind === 1) {
    rgbaData = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
      const gray = data[i];
      rgbaData[i * 4] = gray;
      rgbaData[i * 4 + 1] = gray;
      rgbaData[i * 4 + 2] = gray;
      rgbaData[i * 4 + 3] = 255;
    }
  } else if (kind === 2 || data.length === width * height * 3) {
    rgbaData = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
      rgbaData[i * 4] = data[i * 3];
      rgbaData[i * 4 + 1] = data[i * 3 + 1];
      rgbaData[i * 4 + 2] = data[i * 3 + 2];
      rgbaData[i * 4 + 3] = 255;
    }
  } else {
    rgbaData = data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data);
  }
  return Buffer.from(rgbaData.buffer, rgbaData.byteOffset, rgbaData.byteLength);
}

/** Encode RGBA pixels as a 24-bit BMP (flattened on white). */
export function encodeRgbaAsBmp(width: number, height: number, rgba: Buffer): Buffer {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const padding = rowSize - width * 3;
  const headerSize = 54;
  const imageSize = rowSize * height;
  const fileSize = headerSize + imageSize;
  const buffer = Buffer.alloc(fileSize);

  buffer.write('BM', 0);
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(headerSize, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(-height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);

  let offset = headerSize;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const a = rgba[i + 3];
      const alpha = a / 255;
      const outR = Math.round(r * alpha + 255 * (1 - alpha));
      const outG = Math.round(g * alpha + 255 * (1 - alpha));
      const outB = Math.round(b * alpha + 255 * (1 - alpha));
      buffer[offset] = outB;
      buffer[offset + 1] = outG;
      buffer[offset + 2] = outR;
      offset += 3;
    }
    offset += padding;
  }
  return buffer;
}

export function isPdfFigureLargeEnough(width: number, height: number): boolean {
  return width >= PDF_FIGURE_MIN_EDGE_PX && height >= PDF_FIGURE_MIN_EDGE_PX;
}

/** Guard against materializing huge page scans into RGBA/BMP before downscale. */
export function isPdfFigureWithinMaterializationLimits(width: number, height: number): boolean {
  if (!isPdfFigureLargeEnough(width, height)) return false;
  if (width > PDF_FIGURE_MAX_EDGE_PX || height > PDF_FIGURE_MAX_EDGE_PX) return false;
  return width * height <= PDF_FIGURE_MAX_PIXELS;
}

async function waitForPdfObject<T>(
  objs: {
    get: (name: string, callback: (value: T) => void) => void;
  },
  name: string,
): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(undefined), PDF_IMAGE_RESOLVE_TIMEOUT_MS);
    objs.get(name, (value) => {
      clearTimeout(timeout);
      resolve(value);
    });
  });
}

async function resolvePdfImageObject(
  page: {
    objs: {
      has: (name: string) => boolean;
      get: (name: string, callback: (value: PdfImageObject) => void) => void;
    };
    commonObjs: {
      has: (name: string) => boolean;
      get: (name: string, callback: (value: PdfImageObject) => void) => void;
    };
  },
  imgName: string,
): Promise<PdfImageObject | undefined> {
  if (page.objs.has(imgName)) {
    return waitForPdfObject<PdfImageObject>(page.objs, imgName);
  }
  if (page.commonObjs.has(imgName)) {
    return waitForPdfObject<PdfImageObject>(page.commonObjs, imgName);
  }
  // Image may still be loading; wait per-name instead of pre-resolving all OPS.dependency entries.
  const fromObjs = await waitForPdfObject<PdfImageObject>(page.objs, imgName);
  if (fromObjs) return fromObjs;
  return waitForPdfObject<PdfImageObject>(page.commonObjs, imgName);
}

async function extractImagesFromPage(
  pdfjs: Awaited<ReturnType<typeof loadPdfJs>>,
  page: {
    getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }>;
    objs: {
      has: (name: string) => boolean;
      get: (name: string, callback: (value: PdfImageObject) => void) => void;
    };
    commonObjs: {
      has: (name: string) => boolean;
      get: (name: string, callback: (value: PdfImageObject) => void) => void;
    };
  },
  pageNumber: number,
  imageCounterStart: number,
  seenImageNames: Set<string>,
): Promise<{ attachments: OfficeAttachment[]; nextCounter: number }> {
  const attachments: OfficeAttachment[] = [];
  let imageCounter = imageCounterStart;

  const ops = await page.getOperatorList();
  const { fnArray, argsArray } = ops;

  for (let j = 0; j < fnArray.length; j += 1) {
    const fn = fnArray[j];
    if (fn !== pdfjs.OPS.paintImageXObject && fn !== pdfjs.OPS.paintXObject) continue;

    const imgName = (argsArray[j] as [string])[0];
    if (seenImageNames.has(imgName)) continue;

    try {
      const imgObj = await resolvePdfImageObject(page, imgName);
      if (!imgObj?.data || imgObj.width <= 0 || imgObj.height <= 0) continue;
      if (!isPdfFigureWithinMaterializationLimits(imgObj.width, imgObj.height)) continue;

      seenImageNames.add(imgName);
      imageCounter += 1;
      const rgba = convertToRgbaBuffer(imgObj.data, imgObj.width, imgObj.height, imgObj.kind);
      const bmpBuffer = encodeRgbaAsBmp(imgObj.width, imgObj.height, rgba);
      const attachmentName = `pdf_image_p${pageNumber}_${imageCounter}.bmp`;
      attachments.push({
        type: 'image',
        name: attachmentName,
        mimeType: 'image/bmp',
        data: bmpBuffer.toString('base64'),
      } as OfficeAttachment);
    } catch {
      // Image access failed; continue scanning the page.
    }
  }

  return { attachments, nextCounter: imageCounter };
}

/**
 * Extract candidate figure attachments from a PDF buffer using pdfjs only.
 */
export async function extractPdfFigureAttachments(
  arrayBuffer: ArrayBuffer,
  maxFigures: number,
  maxPages: number = PDF_FIGURE_MAX_PAGES,
): Promise<OfficeAttachment[]> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    verbosity: 0,
  });
  const pdfDocument = await loadingTask.promise;
  const attachments: OfficeAttachment[] = [];
  const seenImageNames = new Set<string>();
  let imageCounter = 0;

  try {
    const pagesToScan = Math.min(pdfDocument.numPages, maxPages);
    for (let pageNumber = 1; pageNumber <= pagesToScan; pageNumber += 1) {
      if (attachments.length >= maxFigures) break;
      const page = await pdfDocument.getPage(pageNumber);
      const result = await extractImagesFromPage(
        pdfjs,
        page,
        pageNumber,
        imageCounter,
        seenImageNames,
      );
      imageCounter = result.nextCounter;
      for (const attachment of result.attachments) {
        attachments.push(attachment);
        if (attachments.length >= maxFigures) break;
      }
    }
  } finally {
    await pdfDocument.destroy();
  }

  return attachments;
}
