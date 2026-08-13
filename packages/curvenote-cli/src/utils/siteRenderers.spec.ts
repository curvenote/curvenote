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

  it('logs malformed config without throwing or overwriting it', () => {
    const malformed = '{"title":';
    const { configPath, session } = setup(malformed);

    expect(() => patchSiteManifestRenderers(session, [])).not.toThrow();
    expect(session.log.error).toHaveBeenCalledWith(expect.stringContaining('config.json'));
    expect(fs.readFileSync(configPath, 'utf-8')).toBe(malformed);
  });

  it('keeps the renderer watcher alive when an apply fails', async () => {
    const { session } = setup('{"title":');

    const dispose = watchSiteRenderers(session);
    await vi.waitFor(() => {
      expect(session.log.error).toHaveBeenCalledWith(expect.stringContaining('config.json'));
    });

    dispose();
  });
});
