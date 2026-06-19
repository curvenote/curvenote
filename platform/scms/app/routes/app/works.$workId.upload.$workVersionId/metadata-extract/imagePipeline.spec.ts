// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  createSharpPipeline,
  downscaleToWebp,
  isRenderableFigureMime,
} from './imagePipeline.server';

/**
 * Build a minimal uncompressed 24-bit BMP (bottom-up, BGR rows padded to 4 bytes).
 * Pixels are provided top-down, left-to-right as [r, g, b] tuples.
 */
function makeBmp(width: number, height: number, pixels: Array<[number, number, number]>): Buffer {
  const rowStride = Math.ceil((width * 3) / 4) * 4;
  const pixelDataSize = rowStride * height;
  const fileSize = 54 + pixelDataSize;

  const buf = Buffer.alloc(fileSize);
  buf.write('BM', 0, 'ascii');
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22); // positive => bottom-up
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(pixelDataSize, 34);

  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y; // file rows are bottom-up
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixels[srcRow * width + x];
      const offset = 54 + y * rowStride + x * 3;
      buf[offset] = b;
      buf[offset + 1] = g;
      buf[offset + 2] = r;
    }
  }
  return buf;
}

describe('createSharpPipeline BMP handling', () => {
  it('decodes a BMP figure and preserves dimensions and channel order', async () => {
    const red: [number, number, number] = [255, 0, 0];
    const green: [number, number, number] = [0, 255, 0];
    const blue: [number, number, number] = [0, 0, 255];
    const white: [number, number, number] = [255, 255, 255];
    const bmp = makeBmp(2, 2, [red, green, blue, white]);

    const pipeline = await createSharpPipeline(bmp, 'image/bmp');
    const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });

    expect(info.width).toBe(2);
    expect(info.height).toBe(2);

    const channels = info.channels;
    const pixelAt = (x: number, y: number) => {
      const i = (y * info.width + x) * channels;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * channels + 3];

    expect(pixelAt(0, 0)).toEqual([255, 0, 0]); // red
    expect(pixelAt(1, 0)).toEqual([0, 255, 0]); // green
    expect(pixelAt(0, 1)).toEqual([0, 0, 255]); // blue
    expect(pixelAt(1, 1)).toEqual([255, 255, 255]); // white

    // 24-bit BMPs carry no alpha; pixels must be opaque, not transparent (blank).
    if (channels === 4) {
      expect(alphaAt(0, 0)).toBe(255);
      expect(alphaAt(1, 0)).toBe(255);
      expect(alphaAt(0, 1)).toBe(255);
      expect(alphaAt(1, 1)).toBe(255);
    }
  });

  it('passes sharp-native formats (png) straight through', async () => {
    const png = await sharp({
      create: { width: 3, height: 2, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();

    const pipeline = await createSharpPipeline(png, 'image/png');
    const meta = await pipeline.metadata();

    expect(meta.format).toBe('png');
    expect(meta.width).toBe(3);
    expect(meta.height).toBe(2);
  });
});

describe('isRenderableFigureMime', () => {
  it('rejects EMF/WMF/PICT metafile formats (any vendor prefix)', () => {
    for (const mime of [
      'image/emf',
      'image/x-emf',
      'image/wmf',
      'image/x-wmf',
      'image/pict',
      'image/x-pict',
    ]) {
      expect(isRenderableFigureMime(mime)).toBe(false);
    }
  });

  it('accepts sharp/bmp-js decodable formats', () => {
    for (const mime of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp']) {
      expect(isRenderableFigureMime(mime)).toBe(true);
    }
  });

  it('accepts unknown/empty mime types so sharp can sniff the bytes', () => {
    expect(isRenderableFigureMime(undefined)).toBe(true);
    expect(isRenderableFigureMime('')).toBe(true);
  });
});

describe('downscaleToWebp', () => {
  it('produces a compact webp capped to maxEdge from a BMP figure', async () => {
    const width = 100;
    const height = 40;
    const pixels: Array<[number, number, number]> = Array.from({ length: width * height }, () => [
      120, 30, 200,
    ]);
    const bmp = makeBmp(width, height, pixels);

    const webp = await downscaleToWebp(bmp, 'image/bmp', { maxEdge: 32, quality: 70 });

    expect(webp.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(webp.subarray(8, 12).toString('ascii')).toBe('WEBP');

    const meta = await sharp(webp).metadata();
    expect(meta.format).toBe('webp');
    // Longest edge capped at 32, aspect ratio preserved (100x40 -> 32x~13).
    expect(meta.width).toBe(32);
    expect(meta.height).toBeLessThanOrEqual(32);
  });

  it('does not enlarge images smaller than maxEdge', async () => {
    const png = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 5, g: 5, b: 5 } },
    })
      .png()
      .toBuffer();

    const webp = await downscaleToWebp(png, 'image/png', { maxEdge: 512, quality: 70 });
    const meta = await sharp(webp).metadata();
    expect(meta.width).toBe(10);
    expect(meta.height).toBe(10);
  });
});
