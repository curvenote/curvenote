/**
 * Copies each relay plugin package's `assets/` tree into `platform/relay/public/assets/<serviceName>/`.
 * The relay serves that directory at HTTP path `/api/assets/<serviceName>/...` (see `app/app.ts`).
 *
 * Sources (no package names hardcoded):
 * - `packages/check-relay-plugin-<serviceName>/assets/`, `packages/service-plugin-<serviceName>/assets/` (legacy)
 * - `extensions/plugins/<anyDir>/assets/` — service folder name strips the same prefixes when present, else the folder name is used
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const relayRoot = join(scriptDir, '..');
const repoRoot = join(relayRoot, '..', '..');
const packagesDir = join(repoRoot, 'packages');
const extensionPluginsDir = join(repoRoot, 'extensions', 'plugins');
const publicAssetsRoot = join(relayRoot, 'public', 'assets');

const PREFIXES = ['check-relay-plugin-', 'service-plugin-'];

mkdirSync(publicAssetsRoot, { recursive: true });

/**
 * @param {string} dirName - package directory name (last segment)
 */
function serviceNameFromPackageDirName(dirName) {
  const prefix = PREFIXES.find((p) => dirName.startsWith(p));
  return prefix != null ? dirName.slice(prefix.length) : dirName;
}

/**
 * @param {string} rootDir
 * @param {{ requireKnownPrefix: boolean }} options
 * @returns {number} number of asset trees copied
 */
function copyPluginAssetsUnder(rootDir, { requireKnownPrefix }) {
  if (!existsSync(rootDir)) return 0;
  let copied = 0;
  for (const ent of readdirSync(rootDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    if (requireKnownPrefix && !PREFIXES.some((p) => ent.name.startsWith(p))) continue;

    const serviceName = serviceNameFromPackageDirName(ent.name);
    const assetsDir = join(rootDir, ent.name, 'assets');
    if (!existsSync(assetsDir) || !statSync(assetsDir).isDirectory()) continue;

    const destDir = join(publicAssetsRoot, serviceName);
    mkdirSync(destDir, { recursive: true });
    cpSync(assetsDir, destDir, { recursive: true });
    copied += 1;
    const label = relative(repoRoot, assetsDir).replaceAll('\\', '/');
    console.log(`copy-plugin-assets: ${label} -> public/assets/${serviceName}/`);
  }
  return copied;
}

let copied = 0;
copied += copyPluginAssetsUnder(packagesDir, { requireKnownPrefix: true });
copied += copyPluginAssetsUnder(extensionPluginsDir, { requireKnownPrefix: false });

if (copied === 0) {
  console.warn(
    'copy-plugin-assets: no plugin assets found under packages/check-relay-plugin-*, packages/service-plugin-*, or extensions/plugins/*/assets',
  );
}
