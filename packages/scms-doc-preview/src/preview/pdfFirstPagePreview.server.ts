/**
 * Fast PDF first-page text preview using pdfjs directly (pages 1–2 only).
 * Avoids a full-document officeparser pass for phase-A text preview.
 */

import type { OfficeContentNode } from 'officeparser';
import {
  astContentToPlainText,
  shouldIncludeSecondPage,
  type PreviewAstData,
} from './previewAstUtils.server.js';
import { loadPdfJs } from './pdfJsUtils.server.js';

/** Minimum extractable text before falling back to officeparser for scanned/image PDFs. */
export const PDF_FAST_PATH_MIN_TEXT_LENGTH = 50;

function paragraphFromText(text: string): OfficeContentNode {
  return { type: 'paragraph', children: [{ type: 'text', text }] } as OfficeContentNode;
}

function pageFromText(text: string, pageNumber: number): OfficeContentNode {
  return {
    type: 'page',
    children: text ? [paragraphFromText(text)] : [],
    metadata: { pageNumber },
  } as OfficeContentNode;
}

async function extractPageText(
  pdfDocument: {
    getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }>;
  },
  pageNumber: number,
): Promise<string> {
  const page = await pdfDocument.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const parts: string[] = [];
  for (const item of textContent.items) {
    if (typeof item === 'object' && item !== null && 'str' in item) {
      const str = (item as { str?: unknown }).str;
      if (typeof str === 'string' && str.length > 0) {
        parts.push(str);
      }
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Build a first-page (and optionally second-page) PDF preview AST from raw bytes.
 * Only reads pages 1–2 from the PDF; does not extract embedded images.
 */
export async function parsePdfFirstPagePreview(arrayBuffer: ArrayBuffer): Promise<PreviewAstData> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    verbosity: 0,
  });
  const pdfDocument = await loadingTask.promise;
  try {
    const numPages = pdfDocument.numPages;
    const page1Node = pageFromText(numPages >= 1 ? await extractPageText(pdfDocument, 1) : '', 1);
    const content: OfficeContentNode[] = [page1Node];

    if (numPages >= 2) {
      const page2Node = pageFromText(await extractPageText(pdfDocument, 2), 2);
      if (shouldIncludeSecondPage(page1Node, page2Node)) {
        content.push(page2Node);
      }
    }

    return {
      type: 'pdf',
      metadata: { pages: numPages },
      content,
      wasTruncated: content.length < numPages,
    };
  } finally {
    await pdfDocument.destroy();
  }
}

/** True when the pdfjs fast path extracted enough text for preview and metadata extract. */
export function isPdfFastPathTextSufficient(ast: PreviewAstData): boolean {
  return astContentToPlainText(ast.content).length >= PDF_FAST_PATH_MIN_TEXT_LENGTH;
}
