// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createSharpPipeline } from './materializeThumbnail.server';

/**
 * Build a minimal uncompressed 24-bit BMP (bottom-up, BGR rows padded to 4 bytes).
 * Pixels are provided top-down, left-to-right as [r, g, b] tuples.
 */
function makeBmp(width: number, height: number, pixels: Array<[number, number, number]>): Buffer {
  const rowStride = Math.ceil((width * 3) / 4) * 4;
  const pixelDataSize = rowStride * height;
  const fileSize = 54 + pixelDataSize;

  const buf = Buffer.alloc(fileSize);
  // BITMAPFILEHEADER
  buf.write('BM', 0, 'ascii');
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10); // pixel data offset
  // BITMAPINFOHEADER
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22); // positive => bottom-up
  buf.writeUInt16LE(1, 26); // planes
  buf.writeUInt16LE(24, 28); // bits per pixel
  buf.writeUInt32LE(0, 30); // BI_RGB (no compression)
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

    expect(pixelAt(0, 0)).toEqual([255, 0, 0]); // red
    expect(pixelAt(1, 0)).toEqual([0, 255, 0]); // green
    expect(pixelAt(0, 1)).toEqual([0, 0, 255]); // blue
    expect(pixelAt(1, 1)).toEqual([255, 255, 255]); // white
  });

  it('produces a valid webp thumbnail from a BMP figure', async () => {
    const bmp = makeBmp(2, 1, [
      [10, 20, 30],
      [40, 50, 60],
    ]);

    const pipeline = await createSharpPipeline(bmp, 'image/bmp');
    const webp = await pipeline.webp({ quality: 80 }).toBuffer();

    // WEBP container: "RIFF"...."WEBP"
    expect(webp.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(webp.subarray(8, 12).toString('ascii')).toBe('WEBP');

    const meta = await sharp(webp).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(2);
    expect(meta.height).toBe(1);
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
