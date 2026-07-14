#!/usr/bin/env node

/**
 * Optional SCMS MCP server at platform/mcp (gitignored clone, like extensions/).
 *
 * When platform/mcp/package.json exists:
 * - Writes turbo.mcp.generated.json so Turborepo hashes gitignored MCP sources
 *   (merged by scripts/turbo-run.mjs).
 *
 * Workspace membership uses the root package.json "platform/*" glob — no root
 * package.json mutation required.
 *
 * Run via npm run generate:mcp-workspace (root postinstall).
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const MCP_DIR = join(ROOT_DIR, 'platform', 'mcp');
const MCP_PACKAGE_JSON = join(MCP_DIR, 'package.json');
const TURBO_MCP_GEN = join(ROOT_DIR, 'turbo.mcp.generated.json');
const TURBO_SCHEMA = 'https://turborepo.org/schema.json';

const TURBO_OPTIONAL_BUILD_INPUTS = [
  'tsconfig.json',
  '.app-config.schema.yml',
  '.app-config.meta.yml',
];

function buildTurboBuildTask(packageRoot) {
  const inputs = ['src/**', '!**/.DS_Store', 'package.json'];
  for (const f of TURBO_OPTIONAL_BUILD_INPUTS) {
    if (existsSync(join(packageRoot, f))) {
      inputs.push(f);
    }
  }
  return {
    dependsOn: ['^build'],
    inputs,
    outputs: ['dist/**', 'types/**'],
  };
}

function main() {
  if (!existsSync(MCP_PACKAGE_JSON)) {
    writeFileSync(
      TURBO_MCP_GEN,
      `${JSON.stringify({ $schema: TURBO_SCHEMA, tasks: {} }, null, 2)}\n`,
      'utf-8',
    );
    console.log('MCP workspace: platform/mcp not present (skipped)');
    return;
  }

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(MCP_PACKAGE_JSON, 'utf-8'));
  } catch (e) {
    console.error(`Invalid ${MCP_PACKAGE_JSON}:`, e.message);
    process.exit(1);
  }

  if (!pkg.name) {
    console.error(`${MCP_PACKAGE_JSON} is missing a "name" field`);
    process.exit(1);
  }

  const tasks = {};
  if (typeof pkg.scripts?.build === 'string') {
    tasks[`${pkg.name}#build`] = buildTurboBuildTask(MCP_DIR);
  }

  writeFileSync(
    TURBO_MCP_GEN,
    `${JSON.stringify({ $schema: TURBO_SCHEMA, tasks }, null, 2)}\n`,
    'utf-8',
  );

  console.log(`MCP workspace: linked ${pkg.name} at platform/mcp`);
  if (Object.keys(tasks).length === 0) {
    console.log('  (no build script — turbo task overrides omitted)');
  }
}

main();
