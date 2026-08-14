import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ISession, SiteRenderer } from '../session/types.js';
import { patchSiteManifestRenderers, watchSiteRenderers } from './siteRenderers.js';

function createSession(sitePath: string): ISession {
  return {
    plugins: { renderers: [] },
    sitePath: () => sitePath,
    publicPath: () => path.join(sitePath, 'public'),
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  } as unknown as ISession;
}

describe('patchSiteManifestRenderers', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function setup(config: string) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-renderers-'));
    dirs.push(dir);
    const configPath = path.join(dir, 'config.json');
    fs.writeFileSync(configPath, config);
    return { configPath, session: createSession(dir) };
  }

  it('does not add an empty renderers key when the manifest has none', () => {
    const original = JSON.stringify({ title: 'Example' });
    const { configPath, session } = setup(original);

    patchSiteManifestRenderers(session, []);

    expect(fs.readFileSync(configPath, 'utf-8')).toBe(original);
  });

  it('writes a changed renderer list', () => {
    const { configPath, session } = setup(JSON.stringify({ title: 'Example' }));
    const renderers: SiteRenderer[] = [{ name: 'Panel', url: '/panel.mjs' }];

    patchSiteManifestRenderers(session, renderers);

    expect(JSON.parse(fs.readFileSync(configPath, 'utf-8')).renderers).toEqual(renderers);
  });

  it('throws on malformed config without overwriting it', () => {
    const malformed = '{"title":';
    const { configPath, session } = setup(malformed);

    expect(() =>
      patchSiteManifestRenderers(session, [{ name: 'Panel', url: '/panel.mjs' }]),
    ).toThrow(/JSON|Unexpected|position/i);
    expect(fs.readFileSync(configPath, 'utf-8')).toBe(malformed);
  });

  it('throws on write failure without corrupting the existing manifest', () => {
    const original = JSON.stringify({ title: 'Example' });
    const { configPath, session } = setup(original);
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('ENOSPC: no space left on device');
    });

    expect(() =>
      patchSiteManifestRenderers(session, [{ name: 'Panel', url: '/panel.mjs' }]),
    ).toThrow(/ENOSPC/);
    expect(fs.readFileSync(configPath, 'utf-8')).toBe(original);
    expect(session.log.error).not.toHaveBeenCalledWith(
      expect.stringContaining('a later rebuild will retry'),
    );

    renameSpy.mockRestore();
  });

  it('keeps the renderer watcher alive when an apply fails', async () => {
    const { session } = setup('{"title":');

    const dispose = watchSiteRenderers(session);
    await vi.waitFor(() => {
      expect(session.log.error).toHaveBeenCalledWith(
        expect.stringContaining('Unable to refresh site renderers while watching'),
      );
    });

    dispose();
  });

  it('re-patches config.json after myst-cli rewrites it past an atomic patch', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-renderers-watch-'));
    dirs.push(dir);
    const publicDir = path.join(dir, 'public');
    fs.mkdirSync(publicDir);
    const source = path.join(dir, 'panel.mjs');
    fs.writeFileSync(source, 'export default function Panel() {}\n');
    const configPath = path.join(dir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ title: 'Example' }));

    const session = {
      ...createSession(dir),
      plugins: { renderers: [{ name: 'Panel', source }] },
      publicPath: () => publicDir,
    };

    const dispose = watchSiteRenderers(session);
    try {
      await vi.waitFor(() => {
        const manifest = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
          renderers?: SiteRenderer[];
        };
        expect(manifest.renderers?.some((r) => r.name === 'Panel')).toBe(true);
      });

      // myst-cli rebuild replaces the manifest without renderers.
      fs.writeFileSync(configPath, JSON.stringify({ title: 'Example', pages: [] }));

      await vi.waitFor(() => {
        const manifest = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
          renderers?: SiteRenderer[];
          pages?: unknown[];
        };
        expect(manifest.pages).toEqual([]);
        expect(manifest.renderers?.some((r) => r.name === 'Panel')).toBe(true);
      });
    } finally {
      dispose();
    }
  });
});
