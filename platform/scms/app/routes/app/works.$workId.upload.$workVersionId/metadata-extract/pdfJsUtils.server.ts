/**
 * Shared pdfjs-dist loader for upload preview helpers (text + figure extraction).
 *
 * pdfjs-dist evaluates `new DOMMatrix()` at module load time in Node. We install
 * @napi-rs/canvas polyfills before the first import and keep a direct require so
 * Vercel file tracing includes the native addon in serverless bundles.
 */

import { createRequire } from 'node:module';

let pdfJsModulePromise: ReturnType<typeof importPdfJsModule> | null = null;

async function importPdfJsModule() {
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

/**
 * Install DOMMatrix / ImageData / Path2D globals required by pdfjs-dist in Node.
 * Safe to call multiple times; no-op when globals are already present.
 */
export function installPdfJsNodeGlobals(): void {
  if (globalThis.DOMMatrix && globalThis.ImageData && globalThis.Path2D) return;

  const require = createRequire(import.meta.url);
  const canvas = require('@napi-rs/canvas') as {
    DOMMatrix?: typeof globalThis.DOMMatrix;
    ImageData?: typeof globalThis.ImageData;
    Path2D?: typeof globalThis.Path2D;
  };

  if (!globalThis.DOMMatrix && canvas.DOMMatrix) {
    globalThis.DOMMatrix = canvas.DOMMatrix;
  }
  if (!globalThis.ImageData && canvas.ImageData) {
    globalThis.ImageData = canvas.ImageData;
  }
  if (!globalThis.Path2D && canvas.Path2D) {
    globalThis.Path2D = canvas.Path2D;
  }

  if (!globalThis.DOMMatrix) {
    throw new Error(
      'pdfjs-dist requires DOMMatrix in Node. Install @napi-rs/canvas and ensure it is bundled for deployment.',
    );
  }

  try {
    if (!globalThis.navigator?.language) {
      globalThis.navigator = {
        language: 'en-US',
        platform: '',
        userAgent: '',
      } as Navigator;
    }
  } catch {
    // Node 22+ may expose a read-only navigator global; pdfjs only needs it for locale hints.
  }
}

export async function loadPdfJs() {
  installPdfJsNodeGlobals();

  if (!pdfJsModulePromise) {
    pdfJsModulePromise = importPdfJsModule();
  }
  const pdfjs = await pdfJsModulePromise;

  try {
    const require = createRequire(import.meta.url);
    pdfjs.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  } catch {
    // Worker auto-resolution is best-effort; pdfjs may still load in some environments.
  }
  return pdfjs;
}
