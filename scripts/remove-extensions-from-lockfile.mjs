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
 * Edits are surgical: Bun's compact packages formatting is preserved.
 * Do not round-trip the lockfile through JSON.stringify — that pretty-prints
 * `packages` and has been concatenated onto the original compact section.
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

/** Pretty-printed packages entry: `"key": [` then a newline (Bun compact keeps `[` on the same line). */
const CONCATENATED_PACKAGES_RE = /\n {2}\}\n {4}"([^"]+)": \[\n/;

/** True for filesystem paths under the private extensions tree (not npm names). */
export function isExtensionFolderPath(pathValue) {
  if (typeof pathValue !== 'string') return false;
  return (
    pathValue === 'extensions' ||
    pathValue.startsWith('extensions/') ||
    pathValue.includes('/extensions/')
  );
}

/** Parse bun.lock JSONC (trailing commas allowed). */
export function parseBunLock(content) {
  const cleaned = content.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(cleaned);
}

/**
 * Recover a lockfile where compact `packages` was closed, then a pretty-printed
 * duplicate of `packages` was appended before the root close.
 *
 * Returns the repaired content, or null if the pattern is not present.
 */
export function tryRepairConcatenatedPackages(content) {
  const match = CONCATENATED_PACKAGES_RE.exec(content);
  if (!match) return null;
  const key = match[1];
  const before = content.slice(0, match.index);
  if (!before.includes('"packages"')) return null;
  if (!before.includes(`    "${key}":`)) return null;
  return `${before}\n  }\n}\n`;
}

function skipWs(s, i) {
  while (i < s.length && /\s/.test(s[i])) i += 1;
  return i;
}

function parseJsonString(s, i) {
  if (s[i] !== '"') throw new Error(`Expected string at ${i}`);
  i += 1;
  while (i < s.length) {
    if (s[i] === '\\') {
      i += 2;
      continue;
    }
    if (s[i] === '"') return i + 1;
    i += 1;
  }
  throw new Error('Unterminated string in bun.lock');
}

function skipMatched(s, i, open, close) {
  let depth = 0;
  let j = i;
  while (j < s.length) {
    const c = s[j];
    if (c === '"') {
      j = parseJsonString(s, j);
      continue;
    }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return j + 1;
    }
    j += 1;
  }
  throw new Error(`Unbalanced ${open}${close} in bun.lock`);
}

function skipValue(s, i) {
  i = skipWs(s, i);
  const ch = s[i];
  if (ch === '"') return parseJsonString(s, i);
  if (ch === '{') return skipMatched(s, i, '{', '}');
  if (ch === '[') return skipMatched(s, i, '[', ']');
  if (ch === 't' || ch === 'f' || ch === 'n') {
    while (i < s.length && /[a-z]/.test(s[i])) i += 1;
    return i;
  }
  while (i < s.length && /[0-9eE+.\-]/.test(s[i])) i += 1;
  return i;
}

function iterObjectProps(s, openBraceIdx) {
  const closeIdx = skipMatched(s, openBraceIdx, '{', '}') - 1;
  const props = [];
  let i = openBraceIdx + 1;
  while (i < closeIdx) {
    i = skipWs(s, i);
    if (i >= closeIdx || s[i] === '}') break;
    if (s[i] === ',') {
      i += 1;
      continue;
    }
    if (s[i] !== '"') break;
    const keyStart = i;
    const keyEnd = parseJsonString(s, i);
    const key = JSON.parse(s.slice(keyStart, keyEnd));
    i = skipWs(s, keyEnd);
    if (s[i] !== ':') throw new Error(`Expected ':' after key ${key}`);
    i += 1;
    const valueStart = skipWs(s, i);
    const valueEnd = skipValue(s, valueStart);
    let propEnd = skipWs(s, valueEnd);
    if (s[propEnd] === ',') propEnd += 1;
    props.push({ key, keyStart, valueStart, valueEnd, propEnd });
    i = propEnd;
  }
  return { props, closeIdx };
}

function findRootProp(content, name) {
  const rootOpen = skipWs(content, 0);
  if (content[rootOpen] !== '{') throw new Error('bun.lock must be a JSON object');
  const { props } = iterObjectProps(content, rootOpen);
  return props.find((p) => p.key === name) ?? null;
}

function removeObjectKeys(s, openBraceIdx, shouldRemove) {
  const { props } = iterObjectProps(s, openBraceIdx);
  const targets = props.filter((p) => shouldRemove(p.key));
  let result = s;
  for (const p of targets.sort((a, b) => b.keyStart - a.keyStart)) {
    result = result.slice(0, p.keyStart) + result.slice(p.propEnd);
  }
  return result;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeDependencyStringProps(s, names) {
  let result = s;
  for (const name of names) {
    const escaped = escapeRegExp(name);
    result = result.replace(new RegExp(`\\s*"${escaped}"\\s*:\\s*"[^"]*"\\s*,?`, 'g'), '');
  }
  result = result.replace(/\{\s*,/g, '{');
  result = result.replace(/,\s*,/g, ',');
  return result;
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

function collectExtensionRemovals(lockfile) {
  const removedKeys = [];
  const packageNames = new Set();

  for (const key of Object.keys(lockfile.workspaces || {})) {
    if (!isExtensionFolderPath(key)) continue;
    const ws = lockfile.workspaces[key];
    if (ws?.name) packageNames.add(ws.name);
    removedKeys.push(`workspaces:${key}`);
  }

  for (const [key, value] of Object.entries(lockfile.packages || {})) {
    const resolutionPath = workspaceResolutionPath(value);
    if (!(resolutionPath && isExtensionFolderPath(resolutionPath))) continue;

    const fromSpec = packageNameFromWorkspaceSpec(value);
    if (fromSpec) packageNames.add(fromSpec);
    packageNames.add(barePackageNameFromKey(key));
    removedKeys.push(`packages:${key}`);
  }

  const names = Array.from(packageNames).filter(Boolean);
  for (const key of Object.keys(lockfile.packages || {})) {
    const matchesName = names.some((name) => key === name || key.startsWith(`${name}/`));
    if (!matchesName) continue;
    removedKeys.push(`packages:${key}`);
  }

  const workspaceKeys = [
    ...new Set(
      removedKeys
        .filter((k) => k.startsWith('workspaces:'))
        .map((k) => k.slice('workspaces:'.length)),
    ),
  ];
  const packageKeys = [
    ...new Set(
      removedKeys.filter((k) => k.startsWith('packages:')).map((k) => k.slice('packages:'.length)),
    ),
  ];

  const dependencyRemovals = [];
  for (const [wsKey, ws] of Object.entries(lockfile.workspaces || {})) {
    if (!ws || typeof ws !== 'object') continue;
    removeDepNames(
      ws.dependencies,
      names,
      dependencyRemovals,
      `workspaces:${wsKey}`,
      'dependencies',
    );
    removeDepNames(
      ws.devDependencies,
      names,
      dependencyRemovals,
      `workspaces:${wsKey}`,
      'devDependencies',
    );
    removeDepNames(
      ws.optionalDependencies,
      names,
      dependencyRemovals,
      `workspaces:${wsKey}`,
      'optionalDependencies',
    );
    removeDepNames(
      ws.peerDependencies,
      names,
      dependencyRemovals,
      `workspaces:${wsKey}`,
      'peerDependencies',
    );
  }

  for (const [pkgKey, pkgEntry] of Object.entries(lockfile.packages || {})) {
    if (!Array.isArray(pkgEntry)) continue;
    const meta = pkgEntry.find((item) => item && typeof item === 'object' && !Array.isArray(item));
    if (!meta) continue;
    removeDepNames(meta.dependencies, names, dependencyRemovals, pkgKey, 'dependencies');
    removeDepNames(meta.devDependencies, names, dependencyRemovals, pkgKey, 'devDependencies');
    removeDepNames(
      meta.optionalDependencies,
      names,
      dependencyRemovals,
      pkgKey,
      'optionalDependencies',
    );
    removeDepNames(meta.peerDependencies, names, dependencyRemovals, pkgKey, 'peerDependencies');
  }

  return {
    workspaceKeys,
    packageKeys,
    packageNames: names,
    dependencyRemovals,
    changed: workspaceKeys.length > 0 || packageKeys.length > 0 || dependencyRemovals.length > 0,
  };
}

function applyRemovals(content, removals) {
  let s = content;
  const packagesProp = findRootProp(s, 'packages');
  if (packagesProp && removals.packageKeys.length > 0 && s[packagesProp.valueStart] === '{') {
    const keys = new Set(removals.packageKeys);
    const names = removals.packageNames;
    s = removeObjectKeys(
      s,
      packagesProp.valueStart,
      (key) => keys.has(key) || names.some((name) => key === name || key.startsWith(`${name}/`)),
    );
  }

  const workspacesProp = findRootProp(s, 'workspaces');
  if (workspacesProp && removals.workspaceKeys.length > 0 && s[workspacesProp.valueStart] === '{') {
    const keys = new Set(removals.workspaceKeys);
    s = removeObjectKeys(s, workspacesProp.valueStart, (key) => keys.has(key));
  }

  if (removals.packageNames.length > 0) {
    s = removeDependencyStringProps(s, removals.packageNames);
  }
  return s;
}

function assertNotConcatenated(content) {
  if (CONCATENATED_PACKAGES_RE.test(content)) {
    throw new Error(
      'bun.lock still has a concatenated packages section (compact close followed by a pretty-printed entry)',
    );
  }
}

export function scrubLockfileContent(content) {
  let working = content;
  let repaired = false;

  try {
    parseBunLock(working);
  } catch (error) {
    const next = tryRepairConcatenatedPackages(working);
    if (!next) {
      throw new Error(`bun.lock is invalid JSONC and could not be auto-repaired: ${error.message}`);
    }
    parseBunLock(next);
    working = next;
    repaired = true;
  }

  const removals = collectExtensionRemovals(parseBunLock(working));
  if (removals.changed) {
    working = applyRemovals(working, removals);
  }

  try {
    parseBunLock(working);
  } catch (error) {
    throw new Error(`Scrubber produced invalid bun.lock: ${error.message}`);
  }
  assertNotConcatenated(working);

  return {
    content: working,
    changed: repaired || removals.changed,
    repaired,
    removedWorkspaceCount: removals.workspaceKeys.length,
    removedPackageCount: removals.packageKeys.length,
    packageNames: removals.packageNames,
    dependencyRemovals: removals.dependencyRemovals,
  };
}

export function removeExtensionsFromBunLock(lockfilePath) {
  if (!existsSync(lockfilePath)) {
    if (!QUIET) console.log(`⚠️  Lockfile not found: ${lockfilePath}`);
    return {
      removedWorkspaceCount: 0,
      removedPackageCount: 0,
      packageNames: [],
      dependencyRemovals: [],
      changed: false,
      repaired: false,
    };
  }

  if (!QUIET) console.log(`Reading ${lockfilePath}...`);
  const originalContent = readFileSync(lockfilePath, 'utf-8');
  const result = scrubLockfileContent(originalContent);

  if (!QUIET) {
    console.log(`\n=== bun.lock ===`);
    if (result.repaired) console.log(`Repaired concatenated packages section`);
    console.log(`Workspaces removed: ${result.removedWorkspaceCount}`);
    console.log(`Package entries removed: ${result.removedPackageCount}`);
    console.log(`Dependency references removed: ${result.dependencyRemovals.length}`);
    if (result.packageNames.length > 0) {
      console.log(`Package names scrubbed: ${result.packageNames.join(', ')}`);
    }
  }

  if (DRY_RUN) {
    return result;
  }

  if (result.changed) {
    if (!QUIET) console.log(`\nWriting updated ${lockfilePath}...`);
    writeFileSync(lockfilePath, result.content, 'utf-8');
  } else if (!QUIET) {
    console.log(`\n✓ No extension-related entries found in bun.lock`);
  }

  return result;
}

function main() {
  const result = removeExtensionsFromBunLock(LOCKFILE);

  if (DRY_RUN) {
    if (!QUIET) {
      console.log('\n=== DRY RUN MODE - No changes made ===');
      console.log(
        `Total entries that would be removed: ${result.removedWorkspaceCount + result.removedPackageCount}`,
      );
      console.log(
        `Dependency references that would be removed: ${result.dependencyRemovals.length}`,
      );
      if (result.repaired) console.log('Would repair concatenated packages section');
    }
    return;
  }

  if (QUIET && result.changed) {
    const parts = [];
    if (result.repaired) parts.push('repaired concatenated packages');
    if (result.removedWorkspaceCount > 0 || result.removedPackageCount > 0) {
      parts.push(
        `removed ${result.removedWorkspaceCount} workspace(s) and ${result.removedPackageCount} package entr${result.removedPackageCount === 1 ? 'y' : 'ies'}`,
      );
    }
    if (result.dependencyRemovals.length > 0) {
      parts.push(`scrubbed ${result.dependencyRemovals.length} dependency reference(s)`);
    }
    console.log(`✓ bun.lock: ${parts.join('; ')}`);
  } else if (!QUIET && result.changed) {
    console.log(
      `\n✓ Scrubbed bun.lock (${result.removedWorkspaceCount} workspaces, ${result.removedPackageCount} packages, ${result.dependencyRemovals.length} deps${result.repaired ? ', repaired concatenation' : ''})`,
    );
  }
}

if (process.argv[1] === __filename) {
  try {
    main();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}
