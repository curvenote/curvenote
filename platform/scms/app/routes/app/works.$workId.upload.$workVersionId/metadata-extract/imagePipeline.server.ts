/**
 * Shared image-processing helpers for document figure thumbnails.
 *
 * Centralises the BMP-aware `sharp` pipeline so both preview generation (downscaling
 * extracted figures at parse time) and any future consumers handle the same set of
 * input formats consistently.
 */

/**
 * Build a `sharp` pipeline from raw image bytes, handling formats that sharp's
 * prebuilt (libvips) binary cannot decode directly.
 *
 * sharp natively decodes JPEG/PNG/WebP/GIF/TIFF/SVG/AVIF, but NOT BMP. PDF figures
 * extracted by officeparser (via pdfjs) are emitted as `image/bmp`, so we decode
 * those to raw pixels with `bmp-js` and feed sharp via its raw input.
 */
export async function createSharpPipeline(buffer: Buffer, mimeType: string) {
  const sharp = (await import('sharp')).default;

  if (mimeType === 'image/bmp') {
    const { decode } = await import('bmp-js');
    const decoded = decode(buffer);
    // bmp-js returns pixels as ABGR (4 bytes/pixel); sharp raw input expects RGBA.
    // Note: bmp-js only writes a real alpha byte for 32-bit BMPs — for lower bit
    // depths it leaves alpha as 0, which sharp would treat as fully transparent
    // (producing a blank thumbnail). Force opaque unless the source is 32-bit.
    const { data, width, height, bitPP } = decoded;
    const hasAlpha = bitPP === 32;
    const rgba = Buffer.allocUnsafe(data.length);
    for (let i = 0; i < data.length; i += 4) {
      rgba[i] = data[i + 3]; // R
      rgba[i + 1] = data[i + 2]; // G
      rgba[i + 2] = data[i + 1]; // B
      rgba[i + 3] = hasAlpha ? data[i] : 0xff; // A
    }
    return sharp(rgba, { raw: { width, height, channels: 4 } });
  }

  return sharp(buffer);
}

/**
 * Downscale an image to a compact webp, capping the longest edge. Returns the encoded
 * webp bytes. Throws if the input cannot be decoded.
 */
export async function downscaleToWebp(
  buffer: Buffer,
  mimeType: string,
  opts: { maxEdge: number; quality: number },
): Promise<Buffer> {
  const pipeline = await createSharpPipeline(buffer, mimeType);
  return pipeline
    .resize(opts.maxEdge, opts.maxEdge, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: opts.quality })
    .toBuffer();
}
