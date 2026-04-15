#!/usr/bin/env node

/**
 * Discovers check-relay plugin packages under extensions/plugins/, then:
 * - Writes app/plugins/load-plugins.ts from load-plugins.tpl.ts
 * - Writes platform/relay/package.json from package.template.json with those packages as "*" deps
 *
 * Run via npm run generate:relay-plugins (root postinstall), matching the SCMS extension flow.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// From platform/relay/scripts up to repository root.
const ROOT_DIR = join(__dirname, '..', '..', '..');
const RELAY_DIR = join(__dirname, '..');
const PLUGINS_DIR = join(ROOT_DIR, 'extensions', 'plugins');
const OUTPUT_DIR = join(RELAY_DIR, 'app', 'plugins');
const TEMPLATE_FILE = join(OUTPUT_DIR, 'load-plugins.tpl.ts');
const OUTPUT_FILE = join(OUTPUT_DIR, 'load-plugins.ts');
const TEMPLATE_PACKAGE_JSON = join(RELAY_DIR, 'package.template.json');
const PACKAGE_JSON = join(RELAY_DIR, 'package.json');

const PLUGIN_PREFIX = 'check-relay-plugin-';

function isRelayPluginPackageName(packageName) {
  if (typeof packageName !== 'string' || packageName.length === 0) return false;

  if (packageName.startsWith('@')) {
    const segments = packageName.split('/');
    if (segments.length !== 2) return false;
    return segments[1].startsWith(PLUGIN_PREFIX);
  }

  return packageName.startsWith(PLUGIN_PREFIX);
}

function loadPackageJson(packageJsonPath) {
  try {
    return JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  } catch {
    return null;
  }
}

function findRelayPluginPackages() {
  if (!existsSync(PLUGINS_DIR)) return [];

  const entries = readdirSync(PLUGINS_DIR, { withFileTypes: true });
  const packageNames = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const packageJsonPath = join(PLUGINS_DIR, entry.name, 'package.json');
    if (!existsSync(packageJsonPath)) continue;

    const pkg = loadPackageJson(packageJsonPath);
    if (!pkg || !isRelayPluginPackageName(pkg.name)) continue;

    packageNames.push(pkg.name);
  }

  return packageNames.sort((a, b) => a.localeCompare(b));
}

function toCamelCase(raw) {
  return raw
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment, index) => {
      const lower = segment.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

function packageNameToImportAlias(packageName) {
  const shortName = packageName.includes('/') ? packageName.split('/')[1] : packageName;
  const base = toCamelCase(shortName);
  if (!base) return 'plugin';
  return /^[a-zA-Z_$]/.test(base) ? base : `plugin${base}`;
}

function parseTemplate(templateContent) {
  const importRegex = /^import\s+([a-zA-Z_$][\w$]*)\s+from\s+['"]([^'"]+)['"];$/gm;
  const importedPluginsByPackage = new Map();
  let match;
  while ((match = importRegex.exec(templateContent)) !== null) {
    importedPluginsByPackage.set(match[2], match[1]);
  }

  const loadPluginsMatch = templateContent.match(/loadPlugins\(\s*\[([\s\S]*?)\]\s*\)/m);
  if (!loadPluginsMatch) {
    throw new Error(`Could not find loadPlugins([ ... ]) call in ${TEMPLATE_FILE}`);
  }

  const basePluginVariables = loadPluginsMatch[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return { importedPluginsByPackage, basePluginVariables };
}

function createUniqueAlias(baseAlias, usedAliases) {
  if (!usedAliases.has(baseAlias)) return baseAlias;

  let i = 2;
  while (usedAliases.has(`${baseAlias}${i}`)) i += 1;
  return `${baseAlias}${i}`;
}

/**
 * Merge scanned relay plugin packages into package.template.json dependencies (monorepo "*" versions).
 */
function generatePackageJson(discoveredPackageNames) {
  if (!existsSync(TEMPLATE_PACKAGE_JSON)) {
    console.error(`Template package.json not found at ${TEMPLATE_PACKAGE_JSON}`);
    process.exit(1);
  }

  const template = JSON.parse(readFileSync(TEMPLATE_PACKAGE_JSON, 'utf-8'));
  const pluginDependencies = {};
  for (const name of discoveredPackageNames) {
    pluginDependencies[name] = '*';
  }

  template.dependencies = {
    ...template.dependencies,
    ...pluginDependencies,
  };

  const sortedDependencies = {};
  Object.keys(template.dependencies)
    .sort()
    .forEach((key) => {
      sortedDependencies[key] = template.dependencies[key];
    });
  template.dependencies = sortedDependencies;

  return `${JSON.stringify(template, null, 2)}\n`;
}

function generateLoaderContents(templateContent, discoveredPackageNames) {
  const { importedPluginsByPackage, basePluginVariables } = parseTemplate(templateContent);
  const usedAliases = new Set(importedPluginsByPackage.values());

  const generatedEntries = [];
  for (const packageName of discoveredPackageNames) {
    if (importedPluginsByPackage.has(packageName)) continue;
    const baseAlias = packageNameToImportAlias(packageName);
    const alias = createUniqueAlias(baseAlias, usedAliases);
    usedAliases.add(alias);
    generatedEntries.push({ packageName, alias });
  }

  const additionalImports = generatedEntries
    .map((entry) => `import ${entry.alias} from '${entry.packageName}';`)
    .join('\n');

  const importInsertIndex = templateContent.lastIndexOf('import ');
  let contentWithImports = templateContent;
  if (additionalImports && importInsertIndex !== -1) {
    const lineEnd = templateContent.indexOf('\n', importInsertIndex);
    const insertionPoint = lineEnd === -1 ? templateContent.length : lineEnd + 1;
    contentWithImports =
      templateContent.slice(0, insertionPoint) +
      `${additionalImports}\n` +
      templateContent.slice(insertionPoint);
  }

  const allPluginVariables = [...basePluginVariables, ...generatedEntries.map((e) => e.alias)].join(', ');
  return contentWithImports.replace(
    /loadPlugins\(\s*\[[\s\S]*?\]\s*\)/m,
    `loadPlugins([${allPluginVariables}])`,
  );
}

function main() {
  const discoveredPackageNames = findRelayPluginPackages();
  if (!existsSync(TEMPLATE_FILE)) {
    throw new Error(`Template file not found: ${TEMPLATE_FILE}`);
  }
  const templateContent = readFileSync(TEMPLATE_FILE, 'utf-8');

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const content = generateLoaderContents(templateContent, discoveredPackageNames);
  writeFileSync(OUTPUT_FILE, content, 'utf-8');

  console.log(`Generated Relay plugin loader: ${OUTPUT_FILE}`);

  console.log('\nGenerating package.json from template...');
  writeFileSync(PACKAGE_JSON, generatePackageJson(discoveredPackageNames), 'utf-8');
  console.log(`Generated package.json at ${PACKAGE_JSON}`);

  if (discoveredPackageNames.length === 0) {
    console.log('No Relay plugin packages found under extensions/plugins/.');
    return;
  }

  console.log(`\nDiscovered ${discoveredPackageNames.length} plugin package(s):`);
  for (const name of discoveredPackageNames) {
    console.log(`  - ${name}`);
  }
}

main();
