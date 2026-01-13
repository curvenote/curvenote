#!/usr/bin/env node

/**
 * Script to generate extension list files from packages in ee/ and extensions/
 *
 * This script scans for packages with a "./client" export and generates:
 * - app/extensions/client.ts
 * - app/extensions/server.ts
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
    // Read the version from the extension's package.json
    try {
      const pkgJson = JSON.parse(readFileSync(pkg.path, 'utf-8'));
      extensionDependencies[pkg.name] = pkgJson.version || '0.0.1';
    } catch (e) {
      console.warn(`Could not read version for ${pkg.name}, using 0.0.1`);
      extensionDependencies[pkg.name] = '0.0.1';
    }
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
}

main();
