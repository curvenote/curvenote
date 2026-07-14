/**
 * Shared pdfjs-dist loader for upload preview helpers (text + figure extraction).
 */

import { createRequire } from 'node:module';

export async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  try {
    const require = createRequire(import.meta.url);
    pdfjs.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  } catch {
    // Worker auto-resolution is best-effort; pdfjs may still load in some environments.
  }
  return pdfjs;
}
