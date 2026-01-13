#!/usr/bin/env node

/**
 * Validates that the extensions key in .app-config.schema.yml only contains
 * whitelisted extension names.
 *
 * This script is used as a pre-commit hook to prevent unauthorized extensions
 * from being added to the schema.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const SCHEMA_FILE = '.app-config.schema.yml';

/**
 * Whitelist of allowed extension names.
 * Add new extensions here after they have been properly reviewed and approved.
 */
const ALLOWED_EXTENSIONS = [
  'sites',
  // Add more extensions here as they are approved
];

/**
 * Checks if the schema file is staged for commit.
 */
function isSchemaFileStaged() {
  try {
    const stagedFiles = execSync('git diff --cached --name-only', {
      encoding: 'utf8',
      cwd: repoRoot,
    })
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);
    return stagedFiles.includes(SCHEMA_FILE);
  } catch (error) {
    // If git command fails, assume file is not staged
    return false;
  }
}

/**
 * Gets the staged version of the schema file from the git index.
 * Returns null if the file is not staged.
 */
function getStagedSchemaContent() {
  try {
    // Use 'git show :<file>' to get the staged version from the index
    const content = execSync(`git show :${SCHEMA_FILE}`, {
      encoding: 'utf8',
      cwd: repoRoot,
    });
    return content;
  } catch (error) {
    // File might not be staged or doesn't exist in index
    return null;
  }
}

/**
 * Reads and parses the staged version of the app-config schema file.
 * Only validates if the file is actually staged.
 */
function readStagedSchemaFile() {
  if (!isSchemaFileStaged()) {
    // File is not staged, nothing to validate
    return null;
  }

  const content = getStagedSchemaContent();
  if (!content) {
    // File is staged but couldn't be read (might be deleted)
    console.log(
      `⚠️  ${SCHEMA_FILE} is staged but could not be read. Skipping validation.`,
    );
    return null;
  }

  try {
    return yaml.load(content);
  } catch (error) {
    console.error(
      `Error parsing staged schema file: ${error.message}`,
    );
    process.exit(1);
  }
}

/**
 * Extracts the extensions object from the schema.
 * Navigates through: properties -> app -> properties -> extensions -> properties
 */
function getExtensions(schema) {
  try {
    return (
      schema?.properties?.app?.properties?.extensions?.properties || {}
    );
  } catch (error) {
    console.error(`Error extracting extensions from schema: ${error.message}`);
    return {};
  }
}

/**
 * Validates that all extension keys are in the whitelist.
 */
function validateExtensions(extensions) {
  const extensionNames = Object.keys(extensions);
  const invalidExtensions = extensionNames.filter(
    (name) => !ALLOWED_EXTENSIONS.includes(name),
  );

  if (invalidExtensions.length > 0) {
    console.error('\n❌ .app-config.schema.yml pre-commit validation failed!\n');
    console.error(
      `The following extensions are not whitelisted: ${invalidExtensions.join(', ')}`,
    );
    console.error(`\nAllowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`);
    console.error(
      '\nTo add a new extension to the whitelist, edit:',
      '.husky/validate-extensions.mjs',
    );
    console.error(
      '\nIf you need to temporarily skip this check, use:',
      'git commit --no-verify',
    );
    return false;
  }

  return true;
}

/**
 * Main validation function.
 */
function main() {
  const schema = readStagedSchemaFile();

  // If schema is null, the file is not staged, so skip validation
  if (schema === null) {
    console.log(
      `ℹ️  ${SCHEMA_FILE} is not staged. Skipping extension validation.`,
    );
    process.exit(0);
  }

  const extensions = getExtensions(schema);
  const isValid = validateExtensions(extensions);

  if (!isValid) {
    process.exit(1);
  }

  console.log('✅ Extension validation passed');
  process.exit(0);
}

main();

