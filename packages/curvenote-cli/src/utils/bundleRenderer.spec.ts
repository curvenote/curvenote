import { describe, expect, it } from 'vitest';
import { needsRendererBundle } from './bundleRenderer.js';

describe('needsRendererBundle', () => {
  it('bundles tsx/jsx/ts sources', () => {
    expect(needsRendererBundle('/site/src/glow-panel.tsx')).toBe(true);
    expect(needsRendererBundle('/site/src/panel.jsx')).toBe(true);
    expect(needsRendererBundle('/site/src/panel.ts')).toBe(true);
  });

  it('copies prebuilt mjs/js without bundling', () => {
    expect(needsRendererBundle('/site/modules/fancy-note-map.mjs')).toBe(false);
    expect(needsRendererBundle('/site/modules/map.js')).toBe(false);
    expect(needsRendererBundle('/site/types.d.ts')).toBe(false);
  });
});
