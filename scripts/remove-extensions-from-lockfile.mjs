#!/usr/bin/env node

// Script to remove all packages starting with "extensions/" from package-lock.json files
// 
// This script processes both:
// - Root package-lock.json
// - platform/scms/package-lock.json
// 
// For each lockfile, it:
// 1. Removes all package entries in the "packages" object that start with "extensions/"
// 2. Removes any node_modules entries that have "resolved" pointing to extensions/
// Note: The workspaces array in packages is NOT modified
// 
// Usage:
//   node remove-extensions-from-lockfile.mjs [--dry-run] [--quiet]
// 
// Options:
//   --dry-run: Show what would be removed without actually modifying the file
//   --quiet:   Suppress verbose output (useful for pre-commit hooks)

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');

// Lockfiles to process
const LOCKFILES = [
  join(repoRoot, 'package-lock.json'),
  join(repoRoot, 'platform', 'scms', 'package-lock.json'),
];

const DRY_RUN = process.argv.includes('--dry-run');
const QUIET = process.argv.includes('--quiet') || process.env.CI === 'true';

function extractPackageName(key, pkg) {
  // If it's a node_modules entry, extract the package name from the path
  if (key.startsWith('node_modules/')) {
    const parts = key.split('/');
    // Handle scoped packages: node_modules/@scope/package
    if (parts[1] && parts[1].startsWith('@')) {
      return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : null;
    }
    // Handle unscoped packages: node_modules/package
    return parts.length >= 2 ? parts[1] : null;
  }
  
  // If the package has a name field, use that
  if (pkg && pkg.name) {
    return pkg.name;
  }
  
  // Try to extract from path like "extensions/.../packages/package-name"
  const match = key.match(/(?:extensions\/[^/]+\/packages\/|\.\.\/\.\.\/extensions\/[^/]+\/packages\/)([^/]+)$/);
  if (match) {
    return match[1];
  }
  
  return null;
}

function removeExtensionsFromLockfile(lockfilePath) {
  if (!existsSync(lockfilePath)) {
    if (!QUIET) {
      console.log(`⚠️  Lockfile not found: ${lockfilePath}`);
    }
    return { removedCount: 0, removedKeys: [], removedLinks: [], packageNames: [] };
  }

  if (!QUIET) {
    console.log(`Reading ${lockfilePath}...`);
  }
  const lockfileContent = readFileSync(lockfilePath, 'utf-8');
  const lockfile = JSON.parse(lockfileContent);

  const originalPackageCount = Object.keys(lockfile.packages || {}).length;
  const removedKeys = [];
  const removedLinks = [];
  const packageNames = new Set(); // Track unique package names

  // Step 1: Remove all package entries that start with "extensions/" or contain "/extensions/"
  // But exclude npm packages like "@app-config/extensions" - only match actual extension folder paths
  const packagesToRemove = [];
  for (const key of Object.keys(lockfile.packages || {})) {
    // Match:
    // - "extensions/..." (root-level extensions)
    // - "../../extensions/..." (relative paths to extensions)
    // - Any path containing "/extensions/" that's not an npm package name
    // Exclude: "@scope/extensions" or "node_modules/@scope/extensions" (npm packages)
    if (key.startsWith('extensions/') || 
        key.includes('/extensions/') && !key.match(/node_modules\/@[^/]+\/extensions$/)) {
      packagesToRemove.push(key);
      const pkg = lockfile.packages[key];
      const pkgName = extractPackageName(key, pkg);
      if (pkgName) {
        packageNames.add(pkgName);
      }
    }
  }

  // Step 2: Remove node_modules entries that link to extensions/ folder paths
  for (const key of Object.keys(lockfile.packages || {})) {
    const pkg = lockfile.packages[key];
    if (pkg && typeof pkg.resolved === 'string') {
      // Match resolved paths that point to extensions/ folder (not npm packages)
      // Match: "extensions/..." or "../../extensions/..." or any path ending with "/extensions/..."
      if ((pkg.resolved.startsWith('extensions/') || 
           pkg.resolved.includes('/extensions/')) &&
          // Exclude npm registry URLs that happen to contain "extensions"
          !pkg.resolved.startsWith('https://') &&
          !pkg.resolved.startsWith('http://')) {
        packagesToRemove.push(key);
        removedLinks.push(key);
        const pkgName = extractPackageName(key, pkg);
        if (pkgName) {
          packageNames.add(pkgName);
        }
      }
    }
  }

  // Remove all identified packages
  for (const key of packagesToRemove) {
    delete lockfile.packages[key];
    removedKeys.push(key);
  }

  const newPackageCount = Object.keys(lockfile.packages || {}).length;
  const removedCount = originalPackageCount - newPackageCount;

  // Display summary (only if not in quiet mode)
  if (!QUIET) {
    const relativePath = lockfilePath.replace(repoRoot + '/', '');
    console.log(`\n=== ${relativePath} ===`);
    console.log(`Total packages: ${originalPackageCount}`);
    console.log(`Packages to remove: ${removedCount}`);
    console.log(`Packages remaining: ${newPackageCount}`);
    if (removedLinks.length > 0) {
      console.log(`  - ${removedLinks.length} were link entries pointing to extensions/`);
    }
    if (packageNames.size > 0) {
      console.log(`  - Package names found: ${Array.from(packageNames).join(', ')}`);
    }
  }

  if (DRY_RUN) {
    if (!QUIET && removedKeys.length > 0) {
      const relativePath = lockfilePath.replace(repoRoot + '/', '');
      console.log(`\n${relativePath} - First 10 entries that would be removed:`);
      removedKeys.slice(0, 10).forEach((key) => {
        console.log(`  - ${key}`);
      });
      if (removedKeys.length > 10) {
        console.log(`  ... and ${removedKeys.length - 10} more`);
      }
    }
    return { removedCount, removedKeys, removedLinks, packageNames: Array.from(packageNames) };
  }

  // Step 3: Remove package names from dependencies/devDependencies in all lockfile entries
  const dependencyRemovals = removePackagesFromLockfileDependencies(lockfile, Array.from(packageNames));

  // Write the updated lockfile
  if (!QUIET && (removedCount > 0 || dependencyRemovals.removed.length > 0)) {
    console.log(`\nWriting updated ${lockfilePath}...`);
  }
  const updatedContent = JSON.stringify(lockfile, null, 2) + '\n';
  if (!DRY_RUN) {
    writeFileSync(lockfilePath, updatedContent, 'utf-8');
  }

  if (!QUIET && dependencyRemovals.removed.length > 0) {
    console.log(`  - Removed ${dependencyRemovals.removed.length} dependency reference(s) from lockfile entries`);
    dependencyRemovals.removed.slice(0, 5).forEach(({ package: pkgKey, name, from }) => {
      const shortKey = pkgKey.length > 50 ? '...' + pkgKey.slice(-47) : pkgKey;
      console.log(`    - ${name} from ${from} in ${shortKey}`);
    });
    if (dependencyRemovals.removed.length > 5) {
      console.log(`    ... and ${dependencyRemovals.removed.length - 5} more`);
    }
  }
  
  return { removedCount, removedKeys, removedLinks, packageNames: Array.from(packageNames), dependencyRemovals: dependencyRemovals.removed };
}

function removePackagesFromLockfileDependencies(lockfile, packageNames) {
  if (packageNames.length === 0) {
    return { removed: [] };
  }

  const removed = [];

  // Remove from all package entries in the lockfile
  for (const key of Object.keys(lockfile.packages || {})) {
    const pkg = lockfile.packages[key];
    if (!pkg) continue;

    // Remove from dependencies
    if (pkg.dependencies) {
      for (const pkgName of packageNames) {
        if (pkg.dependencies[pkgName]) {
          delete pkg.dependencies[pkgName];
          removed.push({ package: key, name: pkgName, from: 'dependencies' });
        }
      }
    }

    // Remove from devDependencies
    if (pkg.devDependencies) {
      for (const pkgName of packageNames) {
        if (pkg.devDependencies[pkgName]) {
          delete pkg.devDependencies[pkgName];
          removed.push({ package: key, name: pkgName, from: 'devDependencies' });
        }
      }
    }
  }

  return { removed };
}

function main() {
  const results = [];
  let totalRemoved = 0;
  let totalDependencyRemovals = 0;

  for (const lockfilePath of LOCKFILES) {
    const result = removeExtensionsFromLockfile(lockfilePath);
    results.push({ lockfile: lockfilePath, ...result });
    totalRemoved += result.removedCount;
    totalDependencyRemovals += result.dependencyRemovals?.length || 0;
  }

  if (DRY_RUN) {
    if (!QUIET) {
      console.log('\n=== DRY RUN MODE - No changes made ===');
      console.log(`\nTotal packages that would be removed across all lockfiles: ${totalRemoved}`);
      if (totalDependencyRemovals > 0) {
        console.log(`Total dependency references that would be removed: ${totalDependencyRemovals}`);
      }
    }
    return;
  }

  // Summary in quiet mode
  if (QUIET && (totalRemoved > 0 || totalDependencyRemovals > 0)) {
    const filesModified = results.filter(r => r.removedCount > 0 || (r.dependencyRemovals?.length || 0) > 0).length;
    let msg = `✓ Removed ${totalRemoved} extension-related package entries from ${filesModified} lockfile(s)`;
    if (totalDependencyRemovals > 0) {
      msg += `, removed ${totalDependencyRemovals} dependency reference(s)`;
    }
    console.log(msg);
  } else if (!QUIET) {
    if (totalRemoved > 0 || totalDependencyRemovals > 0) {
      let msg = `\n✓ Successfully processed ${results.length} lockfile(s), removed ${totalRemoved} total package entries`;
      if (totalDependencyRemovals > 0) {
        msg += `, removed ${totalDependencyRemovals} dependency reference(s)`;
      }
      console.log(msg);
    } else {
      console.log(`\n✓ Processed ${results.length} lockfile(s), no extension-related packages found`);
    }
  }
}

try {
  main();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

