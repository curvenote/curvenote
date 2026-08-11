import fs from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import { hashAndCopyStaticFile } from 'myst-cli-utils';
import type { ISession, SiteRenderer, CurvenoteRendererSpec } from '../session/types.js';
import { bundleRendererSource, needsRendererBundle } from './bundleRenderer.js';

function siteRendererUrl(fileName: string): string {
  return `/${fileName}`;
}

/**
 * Resolve plugin renderer sources to public URLs. TS/TSX/JSX sources are
 * bundled with esbuild first (React external); plain .mjs/.js are copied.
 */
export async function resolveSiteRenderers(session: ISession): Promise<SiteRenderer[]> {
  const renderers = session.plugins?.renderers ?? [];
  const writeFolder = session.publicPath();
  const results: SiteRenderer[] = [];

  for (const renderer of renderers) {
    const resolved = await resolveOneSiteRenderer(session, renderer, writeFolder);
    if (resolved) results.push(resolved);
  }
  return results;
}

async function resolveOneSiteRenderer(
  session: ISession,
  renderer: CurvenoteRendererSpec,
  writeFolder: string,
): Promise<SiteRenderer | undefined> {
  if (!fs.existsSync(renderer.source)) {
    session.log.error(`Cannot find source for renderer "${renderer.name}": ${renderer.source}`);
    return undefined;
  }

  let fileToCopy = renderer.source;
  if (needsRendererBundle(renderer.source)) {
    try {
      fileToCopy = await bundleRendererSource(session, {
        name: renderer.name,
        source: renderer.source,
      });
    } catch {
      return undefined;
    }
  }

  const fileName = hashAndCopyStaticFile(session, fileToCopy, writeFolder, (m: string) => {
    session.log.error(m);
  });
  if (!fileName) return undefined;
  return {
    name: renderer.name,
    url: siteRendererUrl(fileName),
  };
}

/**
 * Patch `_build/site/config.json` with the given renderers list.
 */
export function patchSiteManifestRenderers(session: ISession, renderers: SiteRenderer[]): void {
  const configPath = path.join(session.sitePath(), 'config.json');
  if (!fs.existsSync(configPath)) {
    session.log.debug(`No site config.json at ${configPath}; skipping renderer patch`);
    return;
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  const manifest = JSON.parse(raw) as Record<string, unknown>;
  if (JSON.stringify(manifest.renderers ?? null) === JSON.stringify(renderers)) {
    return;
  }
  manifest.renderers = renderers;
  fs.writeFileSync(configPath, JSON.stringify(manifest));
  if (renderers.length) {
    session.log.info(`🎨 Wrote ${renderers.length} site renderer(s) into config.json`);
  }
}

/**
 * Bundle/copy renderer ESM into public/ and patch config.json.
 * Safe to call repeatedly (e.g. after myst-cli rewrites the manifest on watch).
 */
export async function emitSiteRenderers(session: ISession): Promise<SiteRenderer[]> {
  const renderers = await resolveSiteRenderers(session);
  patchSiteManifestRenderers(session, renderers);
  return renderers;
}

/**
 * Watch config.json (myst-cli rewrites) and bundleable renderer sources.
 * Re-emits site renderers when either changes. Returns a disposer.
 */
export function watchSiteRenderers(session: ISession): () => void {
  const configPath = path.join(session.sitePath(), 'config.json');
  const sources = (session.plugins?.renderers ?? []).map((r) => r.source).filter(Boolean);
  const bundleableSources = sources.filter((source) => needsRendererBundle(source));

  let running = false;
  let queued = false;

  const apply = async () => {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    try {
      do {
        queued = false;
        await emitSiteRenderers(session);
      } while (queued);
    } finally {
      running = false;
    }
  };

  void apply();

  const watchers: { close: () => void }[] = [];

  if (fs.existsSync(configPath)) {
    const configWatcher = fs.watch(configPath, () => {
      void apply();
    });
    watchers.push(configWatcher);
  }

  if (bundleableSources.length) {
    const sourceWatcher = chokidar.watch(bundleableSources, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });
    sourceWatcher.on('change', (file) => {
      session.log.info(`♻️ Renderer source changed: ${file}`);
      void apply();
    });
    sourceWatcher.on('add', (file) => {
      session.log.info(`♻️ Renderer source added: ${file}`);
      void apply();
    });
    watchers.push(sourceWatcher);
    session.log.debug(
      `Watching ${bundleableSources.length} bundleable renderer source(s) for rebuild`,
    );
  }

  return () => {
    watchers.forEach((watcher) => watcher.close());
  };
}
