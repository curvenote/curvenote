#!/usr/bin/env node

/**
 * Script to sync version from platform/scms/package.json to platform/scms/package.template.json
 * This is called after changeset version bumps the version in package.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');

const scmsPackageJson = join(repoRoot, 'platform', 'scms', 'package.json');
const scmsTemplateJson = join(repoRoot, 'platform', 'scms', 'package.template.json');

function main() {
  // Check if files exist
  if (!existsSync(scmsPackageJson)) {
    console.error(`Error: ${scmsPackageJson} not found`);
    process.exit(1);
  }

  if (!existsSync(scmsTemplateJson)) {
    console.error(`Error: ${scmsTemplateJson} not found`);
    process.exit(1);
  }

  // Read version from package.json
  const packageContent = readFileSync(scmsPackageJson, 'utf-8');
  const packageData = JSON.parse(packageContent);
  const version = packageData.version;

  if (!version || typeof version !== 'string') {
    console.error(`Error: Could not read version from ${scmsPackageJson}`);
    process.exit(1);
  }

  // Read and update template.json
  const templateContent = readFileSync(scmsTemplateJson, 'utf-8');
  const templateData = JSON.parse(templateContent);
  templateData.version = version;

  // Write updated template.json
  const updatedContent = JSON.stringify(templateData, null, 2) + '\n';
  writeFileSync(scmsTemplateJson, updatedContent, 'utf-8');

  console.log(`✓ Synced version ${version} to package.template.json`);
}

try {
  main();
} catch (error) {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
