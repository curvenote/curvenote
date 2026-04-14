/**
 * Copies each workspace plugin's `assets/` tree into `apps/relay/public/assets/<serviceName>/`.
 * Convention: package folder `packages/service-plugin-<serviceName>/assets/`.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const relayRoot = join(scriptDir, "..");
const repoRoot = join(relayRoot, "..", "..");
const packagesDir = join(repoRoot, "packages");
const publicAssetsRoot = join(relayRoot, "public", "assets");

mkdirSync(publicAssetsRoot, { recursive: true });

const entries = readdirSync(packagesDir, { withFileTypes: true });
let copied = 0;

for (const ent of entries) {
  if (!ent.isDirectory() || !ent.name.startsWith("service-plugin-")) continue;
  const serviceName = ent.name.slice("service-plugin-".length);
  const assetsDir = join(packagesDir, ent.name, "assets");
  if (!existsSync(assetsDir) || !statSync(assetsDir).isDirectory()) continue;

  const destDir = join(publicAssetsRoot, serviceName);
  mkdirSync(destDir, { recursive: true });
  cpSync(assetsDir, destDir, { recursive: true });
  copied += 1;
  console.log(`copy-plugin-assets: ${ent.name}/assets -> public/assets/${serviceName}/`);
}

if (copied === 0) {
  console.warn("copy-plugin-assets: no packages/service-plugin-*/assets directories found");
}
