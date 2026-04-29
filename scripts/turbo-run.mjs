#!/usr/bin/env node
/**
 * Merges committed turbo.json with generated extension task overrides, then runs the Turbo CLI.
 * Root turbo.json cannot use `extends` for a second file (Turborepo ignores `extends` at the root),
 * and extension sources live under paths gitignored by the main repo, so overrides are generated
 * by platform/scms/scripts/generate-extensions.js into turbo.extensions.generated.json
 * (extensions/ * /packages /* and extensions/plugins/* with a build script).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const BASE_PATH = join(ROOT_DIR, 'turbo.json');
const GENERATED_FRAGMENT_PATH = join(ROOT_DIR, 'turbo.extensions.generated.json');
const MERGED_PATH = join(ROOT_DIR, '.turbo', 'root-turbo.json');

const require = createRequire(import.meta.url);
const turboEntry = join(dirname(require.resolve('turbo/package.json')), 'bin', 'turbo');

function mergeRootTurboConfig() {
  const base = JSON.parse(readFileSync(BASE_PATH, 'utf-8'));
  let extraTasks = {};
  if (existsSync(GENERATED_FRAGMENT_PATH)) {
    try {
      const fragment = JSON.parse(readFileSync(GENERATED_FRAGMENT_PATH, 'utf-8'));
      extraTasks = fragment.tasks ?? {};
    } catch (e) {
      console.warn('[turbo-run] Ignoring invalid turbo.extensions.generated.json:', e.message);
    }
  }
  const merged = {
    ...base,
    tasks: {
      ...base.tasks,
      ...extraTasks,
    },
  };
  mkdirSync(dirname(MERGED_PATH), { recursive: true });
  writeFileSync(MERGED_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf-8');
  return MERGED_PATH;
}

const mergedPath = mergeRootTurboConfig();
const args = ['--root-turbo-json', mergedPath, ...process.argv.slice(2)];
const result = spawnSync(process.execPath, [turboEntry, ...args], {
  stdio: 'inherit',
  cwd: ROOT_DIR,
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
