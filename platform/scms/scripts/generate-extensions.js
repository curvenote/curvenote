#!/usr/bin/env node

/**
 * Script to generate extension list files from packages in ee/ and extensions/
 *
 * This script scans for packages with a "./client" export and generates:
 * - app/extensions/client.ts
 * - app/extensions/server.ts
 *
 * It also scans extensions/.../packages/... for packages with a `build` script and writes
 * turbo.extensions.generated.json (gitignored) so Turborepo hashes gitignored extension sources.
 * Run via npm run generate:extensions (postinstall). Use scripts/turbo-run.mjs to merge that
 * fragment with turbo.json when invoking the turbo CLI.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// From platform/scms/scripts/, go up to curvenote root
const ROOT_DIR = join(__dirname, '..', '..', '..');
const EE_DIR = join(ROOT_DIR, 'ee');
const EXTENSIONS_DIR = join(ROOT_DIR, 'extensions');
const OUTPUT_DIR = join(__dirname, '..', 'app', 'extensions');
const SCMS_DIR = join(__dirname, '..');
const TEMPLATE_PACKAGE_JSON = join(SCMS_DIR, 'package.template.json');
const PACKAGE_JSON = join(SCMS_DIR, 'package.json');
const TURBO_EXT_GEN = join(ROOT_DIR, 'turbo.extensions.generated.json');
const TURBO_SCHEMA = 'https://turborepo.org/schema.json';

/** Optional per-package files that affect `build` for extensions under gitignored paths */
const TURBO_OPTIONAL_BUILD_INPUTS = [
  'tsconfig.json',
  'tsup.config.ts',
  'tsup.config.mjs',
  'extension.schema.yml',
  'postcss.config.js',
  'postcss.config.mjs',
  'postcss.config.cjs',
  'tailwind.config.ts',
  'tailwind.config.mjs',
  'tailwind.config.cjs',
  'vite.config.ts',
];

/**
 * Convert folder name to a camelCase variable name
 * @param {string} folderName - e.g. "sites"
 * @returns {string} - e.g. "sites"
 */
function folderNameToVarName(folderName) {
  // Split by hyphens and convert to camelCase
  const parts = folderName.split('-');
  const firstPart = parts[0];
  const restParts = parts.slice(1).map((part) => part.charAt(0).toUpperCase() + part.slice(1));

  return firstPart + restParts.join('');
}

/**
 * Check if a package.json has a "./client" export
 */
function hasClientExport(packageJson) {
  try {
    const pkg = JSON.parse(packageJson);
    return (
      pkg.exports &&
      (pkg.exports['./client'] || (typeof pkg.exports === 'object' && pkg.exports['./client']))
    );
  } catch (e) {
    return false;
  }
}

/**
 * Find all extension packages in a directory
 */
function findExtensionPackages(dir) {
  const packages = [];

  if (!existsSync(dir)) {
    return packages;
  }

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const packageJsonPath = join(dir, entry.name, 'package.json');
      if (existsSync(packageJsonPath)) {
        const packageJson = readFileSync(packageJsonPath, 'utf-8');
        if (hasClientExport(packageJson)) {
          const pkg = JSON.parse(packageJson);
          packages.push({
            name: pkg.name,
            folderName: entry.name,
            path: packageJsonPath,
          });
        }
      }
    }
  }

  return packages;
}

/**
 * Find all extension packages in nested directories
 */
function findNestedExtensionPackages(baseDir) {
  const packages = [];

  if (!existsSync(baseDir)) {
    return packages;
  }

  const extensionDirs = readdirSync(baseDir, { withFileTypes: true });

  for (const extensionDir of extensionDirs) {
    if (extensionDir.isDirectory()) {
      const packagesDir = join(baseDir, extensionDir.name, 'packages');
      if (existsSync(packagesDir)) {
        const foundPackages = findExtensionPackages(packagesDir);
        packages.push(...foundPackages);
      }
    }
  }

  return packages;
}

/**
 * Packages under each extension repo's `packages` directory with a `build` script
 * (includes workers without a ./client export).
 */
function findNestedExtensionBuildPackages(extensionsDir) {
  const packages = [];

  if (!existsSync(extensionsDir)) {
    return packages;
  }

  const extensionDirs = readdirSync(extensionsDir, { withFileTypes: true });

  for (const extensionDir of extensionDirs) {
    if (!extensionDir.isDirectory()) {
      continue;
    }
    const packagesDir = join(extensionsDir, extensionDir.name, 'packages');
    if (!existsSync(packagesDir)) {
      continue;
    }
    const pkgDirs = readdirSync(packagesDir, { withFileTypes: true });
    for (const pkgDir of pkgDirs) {
      if (!pkgDir.isDirectory()) {
        continue;
      }
      const packageRoot = join(packagesDir, pkgDir.name);
      const packageJsonPath = join(packageRoot, 'package.json');
      if (!existsSync(packageJsonPath)) {
        continue;
      }
      let pkg;
      try {
        pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      } catch {
        continue;
      }
      if (!pkg.name || typeof pkg.scripts?.build !== 'string') {
        continue;
      }
      packages.push({ name: pkg.name, packageRoot });
    }
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

function buildTurboBuildTaskForExtensionPackage(packageRoot) {
  const inputs = ['src/**', '!**/.DS_Store', 'package.json'];
  for (const f of TURBO_OPTIONAL_BUILD_INPUTS) {
    if (existsSync(join(packageRoot, f))) {
      inputs.push(f);
    }
  }
  return {
    inputs,
    outputs: ['dist/**'],
  };
}

/**
 * Write Turborepo task overrides for extension packages (sources live under /extensions/, gitignored by root).
 */
function writeTurboExtensionsGenerated(extensionBuildPackages) {
  const tasks = {};
  for (const { name, packageRoot } of extensionBuildPackages) {
    tasks[`${name}#build`] = buildTurboBuildTaskForExtensionPackage(packageRoot);
  }
  const payload = {
    $schema: TURBO_SCHEMA,
    tasks,
  };
  writeFileSync(TURBO_EXT_GEN, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

/**
 * Generate the client.ts file
 */
function generateClientFile(packages) {
  if (packages.length === 0) {
    return `export const extensions = [];
`;
  }

  const imports = packages
    .map((pkg) => {
      const varName = folderNameToVarName(pkg.folderName) + 'Client';
      return `import { extension as ${varName} } from '${pkg.name}/client';`;
    })
    .join('\n');

  const exports = packages
    .map((pkg) => {
      return folderNameToVarName(pkg.folderName) + 'Client';
    })
    .join(', ');

  return `${imports}

export const extensions = [${exports}];
`;
}

/**
 * Generate the server.ts file
 */
function generateServerFile(packages) {
  if (packages.length === 0) {
    return `export const extensions = [];
`;
  }

  const imports = packages
    .map((pkg) => {
      const varName = folderNameToVarName(pkg.folderName);
      return `import { extension as ${varName} } from '${pkg.name}';`;
    })
    .join('\n');

  const exports = packages
    .map((pkg) => {
      return folderNameToVarName(pkg.folderName);
    })
    .join(', ');

  return `${imports}

export const extensions = [${exports}];
`;
}

/**
 * Generate package.json from template with extension dependencies
 */
function generatePackageJson(packages) {
  if (!existsSync(TEMPLATE_PACKAGE_JSON)) {
    console.error(`Template package.json not found at ${TEMPLATE_PACKAGE_JSON}`);
    process.exit(1);
  }

  const template = JSON.parse(readFileSync(TEMPLATE_PACKAGE_JSON, 'utf-8'));

  // Create dependencies object with extension packages
  const extensionDependencies = {};
  packages.forEach((pkg) => {
    // Assume monorepo + submodule based deployments, so we don't need to specify the version
    extensionDependencies[pkg.name] = '*';
  });

  // Merge extension dependencies into template dependencies
  template.dependencies = {
    ...template.dependencies,
    ...extensionDependencies,
  };

  // Sort dependencies alphabetically
  const sortedDependencies = {};
  Object.keys(template.dependencies)
    .sort()
    .forEach((key) => {
      sortedDependencies[key] = template.dependencies[key];
    });
  template.dependencies = sortedDependencies;

  return JSON.stringify(template, null, 2) + '\n';
}

/**
 * Main function
 */
function main() {
  console.log('Scanning for extension packages...');

  // Find packages in both directories
  // ee/* contains packages directly
  const eePackages = findExtensionPackages(EE_DIR);
  // extensions/*/packages/* contains nested packages
  const extensionPackages = findNestedExtensionPackages(EXTENSIONS_DIR);

  // Combine and sort by package name for consistent output
  const allPackages = [...eePackages, ...extensionPackages].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  if (allPackages.length === 0) {
    console.warn('No extension packages found with "./client" export');
  } else {
    console.log(`Found ${allPackages.length} extension package(s):`);
    allPackages.forEach((pkg) => console.log(`  - ${pkg.name}`));
  }

  // Generate extension files (even if empty)
  const clientContent = generateClientFile(allPackages);
  const serverContent = generateServerFile(allPackages);

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write extension files
  const clientPath = join(OUTPUT_DIR, 'client.ts');
  const serverPath = join(OUTPUT_DIR, 'server.ts');

  writeFileSync(clientPath, clientContent, 'utf-8');
  writeFileSync(serverPath, serverContent, 'utf-8');

  console.log(`\nGenerated extension files:`);
  console.log(`  - ${clientPath}`);
  console.log(`  - ${serverPath}`);

  // Generate package.json from template
  console.log('\nGenerating package.json from template...');
  const packageJsonContent = generatePackageJson(allPackages);
  writeFileSync(PACKAGE_JSON, packageJsonContent, 'utf-8');
  console.log(`Generated package.json at ${PACKAGE_JSON}`);

  const extensionBuildPackages = findNestedExtensionBuildPackages(EXTENSIONS_DIR);
  console.log('\nGenerating Turborepo extension build task overrides...');
  writeTurboExtensionsGenerated(extensionBuildPackages);
  console.log(`Generated ${TURBO_EXT_GEN}`);
  if (extensionBuildPackages.length === 0) {
    console.log('  (no packages with build scripts under extensions/)');
  } else {
    extensionBuildPackages.forEach((p) => console.log(`  - ${p.name}`));
  }
}

main();
