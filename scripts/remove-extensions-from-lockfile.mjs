#!/usr/bin/env node

/**
 * Remove gitignored `extensions/` package details from bun.lock.
 *
 * Local installs can record private extension workspaces (and their
 * dependency edges) in bun.lock. Those paths are gitignored and must not be
 * committed. This script strips:
 *   1. `workspaces` entries whose keys are under `extensions/`
 *   2. `packages` entries that resolve to `workspace:extensions/...`
 *   3. Nested package keys for those package names (e.g. `@hhmi/foo/react`)
 *   4. Dependency references to those package names elsewhere in the lockfile
 *
 * Does NOT touch npm packages whose names merely contain "extensions"
 * (e.g. `@app-config/extensions`).
 *
 * Usage:
 *   node scripts/remove-extensions-from-lockfile.mjs [--dry-run] [--quiet]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');

const LOCKFILE = join(repoRoot, 'bun.lock');

const DRY_RUN = process.argv.includes('--dry-run');
const QUIET = process.argv.includes('--quiet') || process.env.CI === 'true';

/** True for filesystem paths under the private extensions tree (not npm names). */
function isExtensionFolderPath(pathValue) {
  if (typeof pathValue !== 'string') return false;
  return (
    pathValue === 'extensions' ||
    pathValue.startsWith('extensions/') ||
    pathValue.includes('/extensions/')
  );
}

/** Parse bun.lock JSONC (trailing commas allowed). */
function parseBunLock(content) {
  const cleaned = content.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(cleaned);
}

/** Serialize with trailing commas to match Bun's lockfile style. */
function stringifyBunLock(lockfile) {
  const json = JSON.stringify(lockfile, null, 2);
  return json.replace(/(?<![{[,])\n(\s*[}\]])/g, ',\n$1') + '\n';
}

/**
 * Extract workspace path from a Bun packages entry, e.g.
 * `["@hhmi/foo@workspace:extensions/hhmi/packages/foo"]` → `extensions/hhmi/packages/foo`
 */
function workspaceResolutionPath(pkgEntry) {
  const spec = Array.isArray(pkgEntry) ? pkgEntry[0] : pkgEntry;
  if (typeof spec !== 'string') return null;
  const match = spec.match(/@workspace:(.+)$/);
  return match ? match[1] : null;
}

/** Package name from a Bun workspace resolution spec. */
function packageNameFromWorkspaceSpec(pkgEntry) {
  const spec = Array.isArray(pkgEntry) ? pkgEntry[0] : pkgEntry;
  if (typeof spec !== 'string') return null;
  const match = spec.match(/^(.+?)@workspace:/);
  return match ? match[1] : null;
}

/**
 * Bare package name for a packages-map key.
 * `@hhmi/foo` → `@hhmi/foo`
 * `@hhmi/foo/react` → `@hhmi/foo`
 * `lodash` → `lodash`
 * `lodash/fp` → `lodash` (unscoped nested — uncommon in Bun keys)
 */
function barePackageNameFromKey(key) {
  if (key.startsWith('@')) {
    const parts = key.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : key;
  }
  return key.split('/')[0];
}

function removeDepNames(depMap, packageNames, removed, ownerKey, from) {
  if (!depMap || typeof depMap !== 'object') return;
  for (const name of packageNames) {
    if (Object.prototype.hasOwnProperty.call(depMap, name)) {
      delete depMap[name];
      removed.push({ package: ownerKey, name, from });
    }
  }
}

function scrubDependencyMaps(lockfile, packageNames) {
  const removed = [];
  if (packageNames.length === 0) return { removed };

  for (const [wsKey, ws] of Object.entries(lockfile.workspaces || {})) {
    if (!ws || typeof ws !== 'object') continue;
    removeDepNames(ws.dependencies, packageNames, removed, `workspaces:${wsKey}`, 'dependencies');
    removeDepNames(
      ws.devDependencies,
      packageNames,
      removed,
      `workspaces:${wsKey}`,
      'devDependencies',
    );
    removeDepNames(
      ws.optionalDependencies,
      packageNames,
      removed,
      `workspaces:${wsKey}`,
      'optionalDependencies',
    );
    removeDepNames(
      ws.peerDependencies,
      packageNames,
      removed,
      `workspaces:${wsKey}`,
      'peerDependencies',
    );
  }

  for (const [pkgKey, pkgEntry] of Object.entries(lockfile.packages || {})) {
    if (!Array.isArray(pkgEntry)) continue;
    const meta = pkgEntry.find((item) => item && typeof item === 'object' && !Array.isArray(item));
    if (!meta) continue;
    removeDepNames(meta.dependencies, packageNames, removed, pkgKey, 'dependencies');
    removeDepNames(meta.devDependencies, packageNames, removed, pkgKey, 'devDependencies');
    removeDepNames(
      meta.optionalDependencies,
      packageNames,
      removed,
      pkgKey,
      'optionalDependencies',
    );
    removeDepNames(meta.peerDependencies, packageNames, removed, pkgKey, 'peerDependencies');
  }

  return { removed };
}

function removeExtensionsFromBunLock(lockfilePath) {
  if (!existsSync(lockfilePath)) {
    if (!QUIET) console.log(`⚠️  Lockfile not found: ${lockfilePath}`);
    return {
      removedWorkspaceCount: 0,
      removedPackageCount: 0,
      removedKeys: [],
      packageNames: [],
      dependencyRemovals: [],
      changed: false,
    };
  }

  if (!QUIET) console.log(`Reading ${lockfilePath}...`);
  const originalContent = readFileSync(lockfilePath, 'utf-8');
  const lockfile = parseBunLock(originalContent);

  const removedKeys = [];
  const packageNames = new Set();

  // 1) Remove workspaces under extensions/
  for (const key of Object.keys(lockfile.workspaces || {})) {
    if (!isExtensionFolderPath(key)) continue;
    const ws = lockfile.workspaces[key];
    if (ws?.name) packageNames.add(ws.name);
    delete lockfile.workspaces[key];
    removedKeys.push(`workspaces:${key}`);
  }

  // 2) Remove packages that resolve into extensions/, collect names
  for (const [key, value] of Object.entries(lockfile.packages || {})) {
    const resolutionPath = workspaceResolutionPath(value);
    if (!(resolutionPath && isExtensionFolderPath(resolutionPath))) continue;

    const fromSpec = packageNameFromWorkspaceSpec(value);
    if (fromSpec) packageNames.add(fromSpec);
    packageNames.add(barePackageNameFromKey(key));

    delete lockfile.packages[key];
    removedKeys.push(`packages:${key}`);
  }

  // 3) Remove nested keys for discovered package names (@scope/pkg/...)
  const names = Array.from(packageNames).filter(Boolean);
  for (const key of Object.keys(lockfile.packages || {})) {
    const matchesName = names.some((name) => key === name || key.startsWith(`${name}/`));
    if (!matchesName) continue;
    delete lockfile.packages[key];
    removedKeys.push(`packages:${key}`);
  }

  const dependencyRemovals = scrubDependencyMaps(lockfile, names).removed;

  const removedWorkspaceCount = removedKeys.filter((k) => k.startsWith('workspaces:')).length;
  // Deduplicate keys in case step 2 and 3 both listed the same package
  const uniquePackageKeys = [...new Set(removedKeys.filter((k) => k.startsWith('packages:')))];
  const removedPackageCount = uniquePackageKeys.length;
  const changed =
    removedWorkspaceCount > 0 || removedPackageCount > 0 || dependencyRemovals.length > 0;

  if (!QUIET) {
    console.log(`\n=== bun.lock ===`);
    console.log(`Workspaces removed: ${removedWorkspaceCount}`);
    console.log(`Package entries removed: ${removedPackageCount}`);
    console.log(`Dependency references removed: ${dependencyRemovals.length}`);
    if (names.length > 0) {
      console.log(`Package names scrubbed: ${names.join(', ')}`);
    }
  }

  if (DRY_RUN) {
    if (!QUIET && removedKeys.length > 0) {
      console.log(`\nFirst removed keys:`);
      [...new Set(removedKeys)].slice(0, 15).forEach((key) => console.log(`  - ${key}`));
      if (removedKeys.length > 15) {
        console.log(`  ... and more`);
      }
    }
    return {
      removedWorkspaceCount,
      removedPackageCount,
      removedKeys: [...new Set(removedKeys)],
      packageNames: names,
      dependencyRemovals,
      changed,
    };
  }

  if (changed) {
    if (!QUIET) console.log(`\nWriting updated ${lockfilePath}...`);
    writeFileSync(lockfilePath, stringifyBunLock(lockfile), 'utf-8');
  } else if (!QUIET) {
    console.log(`\n✓ No extension-related entries found in bun.lock`);
  }

  return {
    removedWorkspaceCount,
    removedPackageCount,
    removedKeys: [...new Set(removedKeys)],
    packageNames: names,
    dependencyRemovals,
    changed,
  };
}

function main() {
  const result = removeExtensionsFromBunLock(LOCKFILE);
  const totalRemoved = result.removedWorkspaceCount + result.removedPackageCount;

  if (DRY_RUN) {
    if (!QUIET) {
      console.log('\n=== DRY RUN MODE - No changes made ===');
      console.log(`Total entries that would be removed: ${totalRemoved}`);
      console.log(
        `Dependency references that would be removed: ${result.dependencyRemovals.length}`,
      );
    }
    return;
  }

  if (QUIET && result.changed) {
    let msg = `✓ Removed ${result.removedWorkspaceCount} workspace(s) and ${result.removedPackageCount} package entr${result.removedPackageCount === 1 ? 'y' : 'ies'} from bun.lock`;
    if (result.dependencyRemovals.length > 0) {
      msg += `, scrubbed ${result.dependencyRemovals.length} dependency reference(s)`;
    }
    console.log(msg);
  } else if (!QUIET && result.changed) {
    console.log(
      `\n✓ Scrubbed bun.lock (${result.removedWorkspaceCount} workspaces, ${result.removedPackageCount} packages, ${result.dependencyRemovals.length} deps)`,
    );
  }
}

try {
  main();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
