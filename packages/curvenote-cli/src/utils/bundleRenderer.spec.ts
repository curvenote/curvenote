import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  hashRendererSource,
  isRendererBundleFresh,
  needsRendererBundle,
} from './bundleRenderer.js';

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

describe('isRendererBundleFresh', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function tmpDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'renderer-hash-'));
    dirs.push(dir);
    return dir;
  }

  it('is fresh only when outfile and matching hash sidecar exist', () => {
    const dir = tmpDir();
    const source = path.join(dir, 'panel.tsx');
    const outfile = path.join(dir, 'Panel.mjs');
    fs.writeFileSync(source, 'export default 1;\n');
    const hash = hashRendererSource(source);

    expect(isRendererBundleFresh(outfile, hash)).toBe(false);

    fs.writeFileSync(outfile, 'export default 1;\n');
    expect(isRendererBundleFresh(outfile, hash)).toBe(false);

    fs.writeFileSync(`${outfile}.hash`, `${hash}\n`);
    expect(isRendererBundleFresh(outfile, hash)).toBe(true);

    fs.writeFileSync(source, 'export default 2;\n');
    expect(isRendererBundleFresh(outfile, hashRendererSource(source))).toBe(false);
  });
});
