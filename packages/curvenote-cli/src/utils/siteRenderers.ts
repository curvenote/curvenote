import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { hashAndCopyStaticFile } from 'myst-cli-utils';
import type { ISession, SiteRenderer, CurvenoteRendererSpec } from '../session/types.js';

function siteRendererUrl(fileName: string): string {
  return `/${fileName}`;
}

/**
 * Copy plugin ESM renderer sources into the site public folder and return
 * manifest entries. Does not touch config.json.
 */
export function resolveSiteRenderers(session: ISession): SiteRenderer[] {
  const renderers = session.plugins?.renderers ?? [];
  const writeFolder = session.publicPath();
  return renderers
    .map((renderer: CurvenoteRendererSpec): SiteRenderer | undefined => {
      if (!fs.existsSync(renderer.source)) {
        session.log.error(
          `Cannot find source for renderer "${renderer.name}": ${renderer.source}`,
        );
        return undefined;
      }
      const fileName = hashAndCopyStaticFile(session, renderer.source, writeFolder, (m: string) => {
        session.log.error(m);
      });
      if (!fileName) return undefined;
      return {
        name: renderer.name,
        url: siteRendererUrl(fileName),
      };
    })
    .filter((renderer: SiteRenderer | undefined): renderer is SiteRenderer => !!renderer);
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
 * Copy renderer ESM into public/ and patch config.json.
 * Safe to call repeatedly (e.g. after myst-cli rewrites the manifest on watch).
 */
export function emitSiteRenderers(session: ISession): SiteRenderer[] {
  const renderers = resolveSiteRenderers(session);
  patchSiteManifestRenderers(session, renderers);
  return renderers;
}

/**
 * Watch config.json and re-apply renderers whenever myst-cli rewrites it.
 * Returns a disposer.
 */
export function watchSiteRenderers(session: ISession): () => void {
  const configPath = path.join(session.sitePath(), 'config.json');
  let writing = false;
  const apply = () => {
    if (writing) return;
    writing = true;
    try {
      emitSiteRenderers(session);
    } finally {
      // Allow myst/ourselves to finish before accepting another event
      setTimeout(() => {
        writing = false;
      }, 50);
    }
  };
  apply();
  if (!fs.existsSync(configPath)) {
    return () => {};
  }
  const watcher = fs.watch(configPath, () => apply());
  return () => watcher.close();
}
