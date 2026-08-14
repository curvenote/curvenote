import fs from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import { hashAndCopyStaticFile } from 'myst-cli-utils';
import type { ISession, SiteRenderer, CurvenoteRendererSpec } from '../session/types.js';
import { bundleRendererSource, needsRendererBundle } from './bundleRenderer.js';

function siteRendererUrl(fileName: string): string {
  return `/${fileName}`;
}

export type EmitSiteRenderersResult = {
  renderers: SiteRenderer[];
  /** Absolute paths to watch for rebuilds (entries + transitive bundle inputs). */
  watchPaths: string[];
};

/**
 * Resolve plugin renderer sources to public URLs. TS/TSX/JSX sources are
 * bundled with esbuild first (React external); plain .mjs/.js are copied.
 * Failures soft-fail: the renderer is omitted and an error is logged.
 */
export async function resolveSiteRenderers(
  session: ISession,
): Promise<{ renderers: SiteRenderer[]; watchPaths: string[] }> {
  const renderers = session.plugins?.renderers ?? [];
  const writeFolder = session.publicPath();
  const results: SiteRenderer[] = [];
  const watchPaths = new Set<string>();

  for (const renderer of renderers) {
    const resolved = await resolveOneSiteRenderer(session, renderer, writeFolder, watchPaths);
    if (resolved) results.push(resolved);
  }
  return { renderers: results, watchPaths: [...watchPaths] };
}

async function resolveOneSiteRenderer(
  session: ISession,
  renderer: CurvenoteRendererSpec,
  writeFolder: string,
  watchPaths: Set<string>,
): Promise<SiteRenderer | undefined> {
  if (!fs.existsSync(renderer.source)) {
    session.log.error(
      `Cannot find source for renderer "${renderer.name}": ${renderer.source}\n` +
        `Continuing without this renderer.`,
    );
    return undefined;
  }

  watchPaths.add(path.resolve(renderer.source));

  let fileToCopy = renderer.source;
  if (needsRendererBundle(renderer.source)) {
    const bundled = await bundleRendererSource(session, {
      name: renderer.name,
      source: renderer.source,
    });
    if (!bundled) {
      session.log.error(
        `Renderer "${renderer.name}" was not emitted (bundle failed or skipped).\n` +
          `Continuing without this renderer.`,
      );
      return undefined;
    }
    fileToCopy = bundled.outfile;
    for (const input of bundled.inputs) watchPaths.add(input);
  }

  const fileName = hashAndCopyStaticFile(session, fileToCopy, writeFolder, (m: string) => {
    session.log.error(m);
  });
  if (!fileName) {
    session.log.error(
      `Failed to copy renderer "${renderer.name}" into the site public folder.\n` +
        `Continuing without this renderer.`,
    );
    return undefined;
  }
  return {
    name: renderer.name,
    url: siteRendererUrl(fileName),
  };
}

/**
 * Atomically replace `config.json` so a failed write cannot truncate the live file.
 */
function writeSiteManifestAtomic(configPath: string, contents: string): void {
  const tempPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tempPath, contents);
    fs.renameSync(tempPath, configPath);
  } catch (error) {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // Temp may not exist if write failed before creating it.
    }
    throw error;
  }
}

/**
 * Patch `_build/site/config.json` with the given renderers list.
 * Throws on read/parse/write failure so build and deploy fail closed.
 * Soft-fail belongs in the watch path, which retries on the next change.
 */
export function patchSiteManifestRenderers(session: ISession, renderers: SiteRenderer[]): void {
  const configPath = path.join(session.sitePath(), 'config.json');
  if (!fs.existsSync(configPath)) {
    session.log.debug(`No site config.json at ${configPath}; skipping renderer patch`);
    return;
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  const manifest = JSON.parse(raw) as Record<string, unknown>;
  if (!renderers.length && manifest.renderers === undefined) return;
  if (JSON.stringify(manifest.renderers ?? null) === JSON.stringify(renderers)) return;
  manifest.renderers = renderers;
  writeSiteManifestAtomic(configPath, JSON.stringify(manifest));
  if (renderers.length) {
    session.log.info(`🎨 Wrote ${renderers.length} site renderer(s) into config.json`);
  }
}

/**
 * Bundle/copy renderer ESM into public/ and patch config.json.
 * Safe to call repeatedly (e.g. after myst-cli rewrites the manifest on watch).
 * Soft-fails per renderer with error logs; still throws if the site manifest cannot be patched.
 */
export async function emitSiteRenderers(session: ISession): Promise<EmitSiteRenderersResult> {
  const { renderers, watchPaths } = await resolveSiteRenderers(session);
  patchSiteManifestRenderers(session, renderers);
  return { renderers, watchPaths };
}

/**
 * Watch config.json (myst-cli rewrites) and renderer sources (including
 * transitive bundle inputs discovered via esbuild metafile).
 * Re-emits site renderers when either changes. Returns a disposer.
 *
 * Config is watched via chokidar so atomic rename patches (new inode)
 * do not leave the watcher stuck on a deleted file.
 */
export function watchSiteRenderers(session: ISession): () => void {
  const configPath = path.join(session.sitePath(), 'config.json');
  const initialSources = (session.plugins?.renderers ?? [])
    .map((r) => r.source)
    .filter(Boolean)
    .map((source) => path.resolve(source));

  let running = false;
  let queued = false;
  let sourceWatcher: chokidar.FSWatcher | undefined;
  const watchedSources = new Set<string>();

  const ensureSourceWatcher = (paths: string[]) => {
    const bundleable = paths.filter((source) => needsRendererBundle(source));
    const toAdd = bundleable.filter((p) => !watchedSources.has(p));
    if (!toAdd.length && sourceWatcher) return;

    if (!sourceWatcher) {
      if (!bundleable.length) return;
      sourceWatcher = chokidar.watch(bundleable, {
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
      for (const p of bundleable) watchedSources.add(p);
      session.log.debug(`Watching ${bundleable.length} renderer source(s) for rebuild`);
      return;
    }

    if (toAdd.length) {
      sourceWatcher.add(toAdd);
      for (const p of toAdd) watchedSources.add(p);
      session.log.debug(`Watching ${toAdd.length} additional renderer input(s)`);
    }
  };

  const apply = async () => {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    try {
      do {
        queued = false;
        try {
          const { watchPaths } = await emitSiteRenderers(session);
          ensureSourceWatcher(watchPaths.length ? watchPaths : initialSources);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          session.log.error(
            `Unable to refresh site renderers while watching: ${message}\n` +
              `The dev server will continue and retry on the next change.`,
          );
        }
      } while (queued);
    } finally {
      running = false;
    }
  };

  void apply();

  // Watch the path with chokidar (not fs.watch on the file). Atomic
  // renameSync replaces config.json with a new inode; Linux/macOS
  // fs.watch stays on the old inode and misses later myst-cli rewrites.
  let configWatcher: chokidar.FSWatcher | undefined;
  if (fs.existsSync(configPath)) {
    configWatcher = chokidar.watch(configPath, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });
    configWatcher.on('change', () => {
      void apply();
    });
    configWatcher.on('add', () => {
      void apply();
    });
  }

  return () => {
    sourceWatcher?.close();
    void configWatcher?.close();
  };
}
