/**
 * Shared pdfjs-dist loader for upload preview helpers (text + figure extraction).
 *
 * pdfjs-dist evaluates `new DOMMatrix()` at module load time in Node. We install
 * @napi-rs/canvas polyfills before the first import and keep a direct require so
 * Vercel file tracing includes the native addon in serverless bundles.
 *
 * In Node, pdfjs uses a "fake worker" that dynamically imports pdf.worker.mjs.
 * Statically import the worker here and expose it on globalThis.pdfjsWorker so
 * bundlers trace the worker file and pdfjs does not resolve it from node_modules
 * at runtime (which fails on Vercel when the worker is not copied).
 */

import { createRequire } from 'node:module';
import * as pdfjsWorkerModule from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

declare global {
  // pdfjs-dist reads this in Node to avoid dynamic worker import.
  // eslint-disable-next-line no-var
  var pdfjsWorker: typeof pdfjsWorkerModule | undefined;
}

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

/** Register the worker handler for pdfjs Node fake-worker mode. */
export function installPdfJsWorkerGlobal(): void {
  if (globalThis.pdfjsWorker?.WorkerMessageHandler) return;
  globalThis.pdfjsWorker = pdfjsWorkerModule;
}

export async function loadPdfJs() {
  installPdfJsNodeGlobals();
  installPdfJsWorkerGlobal();

  if (!pdfJsModulePromise) {
    pdfJsModulePromise = importPdfJsModule();
  }
  return pdfJsModulePromise;
}
