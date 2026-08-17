import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bundleRendererSource,
  hashRendererInputs,
  isRendererBundleFresh,
  needsRendererBundle,
  resetEsbuildLoaderForTests,
} from './bundleRenderer.js';
import type { ISession } from '../session/types.js';

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

describe('renderer input graph freshness', () => {
  const dirs: string[] = [];

  afterEach(() => {
    resetEsbuildLoaderForTests();
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function tmpDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'renderer-hash-'));
    dirs.push(dir);
    return dir;
  }

  function mockSession(buildPath: string): ISession {
    return {
      buildPath: () => buildPath,
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
    } as unknown as ISession;
  }

  it('is fresh only when outfile and matching input-graph sidecar exist', () => {
    const dir = tmpDir();
    const source = path.join(dir, 'panel.tsx');
    const outfile = path.join(dir, 'Panel.mjs');
    fs.writeFileSync(source, 'export default 1;\n');

    expect(isRendererBundleFresh(outfile)).toBe(false);

    fs.writeFileSync(outfile, 'export default 1;\n');
    expect(isRendererBundleFresh(outfile)).toBe(false);

    const hash = hashRendererInputs([source]);
    fs.writeFileSync(`${outfile}.hash`, JSON.stringify({ hash, inputs: [source] }));
    expect(isRendererBundleFresh(outfile)).toBe(true);

    fs.writeFileSync(source, 'export default 2;\n');
    expect(isRendererBundleFresh(outfile)).toBe(false);
  });

  it('rebuilds when a transitive import changes', async () => {
    const dir = tmpDir();
    const buildPath = path.join(dir, 'build');
    const source = path.join(dir, 'panel.ts');
    const dep = path.join(dir, 'dep.ts');
    fs.writeFileSync(dep, 'export const value = 1;\n');
    fs.writeFileSync(source, `import { value } from './dep';\nexport default value;\n`);

    const session = mockSession(buildPath);
    const first = await bundleRendererSource(session, { name: 'panel', source });
    expect(first).toBeDefined();
    const before = fs.readFileSync(first!.outfile, 'utf-8');

    expect(isRendererBundleFresh(first!.outfile)).toBe(true);

    fs.writeFileSync(dep, 'export const value = 2;\n');
    expect(isRendererBundleFresh(first!.outfile)).toBe(false);

    const second = await bundleRendererSource(session, { name: 'panel', source });
    expect(second).toBeDefined();
    const after = fs.readFileSync(second!.outfile, 'utf-8');
    expect(after).not.toBe(before);
    expect(after).toContain('2');
  });
});
