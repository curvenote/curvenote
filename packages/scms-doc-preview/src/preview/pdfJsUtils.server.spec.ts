// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it } from 'vitest';
import { installPdfJsNodeGlobals, installPdfJsWorkerGlobal } from './pdfJsUtils.server.js';

describe('installPdfJsNodeGlobals', () => {
  const saved = {
    DOMMatrix: globalThis.DOMMatrix,
    ImageData: globalThis.ImageData,
    Path2D: globalThis.Path2D,
  };

  afterEach(() => {
    globalThis.DOMMatrix = saved.DOMMatrix;
    globalThis.ImageData = saved.ImageData;
    globalThis.Path2D = saved.Path2D;
  });

  it('installs DOMMatrix and related globals from @napi-rs/canvas', () => {
    globalThis.DOMMatrix = undefined as unknown as typeof globalThis.DOMMatrix;
    globalThis.ImageData = undefined as unknown as typeof globalThis.ImageData;
    globalThis.Path2D = undefined as unknown as typeof globalThis.Path2D;

    installPdfJsNodeGlobals();

    expect(globalThis.DOMMatrix).toBeDefined();
    expect(globalThis.ImageData).toBeDefined();
    expect(globalThis.Path2D).toBeDefined();
    expect(new globalThis.DOMMatrix()).toBeInstanceOf(globalThis.DOMMatrix);
  });
});

describe('installPdfJsWorkerGlobal', () => {
  it('exposes WorkerMessageHandler for pdfjs fake-worker mode', () => {
    const previous = globalThis.pdfjsWorker;
    globalThis.pdfjsWorker = undefined;

    installPdfJsWorkerGlobal();

    expect(globalThis.pdfjsWorker?.WorkerMessageHandler).toBeTypeOf('function');

    globalThis.pdfjsWorker = previous;
  });
});
