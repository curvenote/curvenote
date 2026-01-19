#!/usr/bin/env node

/**
 * Script to remove all prisma and @prisma/client entries from package-lock.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const lockfilePath = join(repoRoot, 'package-lock.json');

function removePrismaEntries(lockfile) {
  // Remove prisma packages from the packages object
  const packages = lockfile.packages || {};
  const keysToRemove = [];
  
  for (const key of Object.keys(packages)) {
    // Remove any package that is prisma or @prisma/*
    if (key.includes('/prisma') || key.includes('@prisma/')) {
      keysToRemove.push(key);
    }
  }
  
  for (const key of keysToRemove) {
    delete packages[key];
  }
  
  // Remove prisma from dependencies/devDependencies in all workspace packages
  function cleanDependencies(deps) {
    if (!deps) return;
    delete deps.prisma;
    delete deps['@prisma/client'];
  }
  
  // Clean root package
  if (packages['']) {
    cleanDependencies(packages[''].dependencies);
    cleanDependencies(packages[''].devDependencies);
  }
  
  // Clean all workspace packages
  for (const key of Object.keys(packages)) {
    if (key && key !== '') {
      cleanDependencies(packages[key].dependencies);
      cleanDependencies(packages[key].devDependencies);
      cleanDependencies(packages[key].peerDependencies);
      if (packages[key].peerDependenciesMeta) {
        delete packages[key].peerDependenciesMeta.prisma;
      }
    }
  }
  
  return lockfile;
}

function main() {
  console.log('Reading package-lock.json...');
  const content = readFileSync(lockfilePath, 'utf-8');
  const lockfile = JSON.parse(content);
  
  console.log('Removing prisma entries...');
  const cleaned = removePrismaEntries(lockfile);
  
  console.log('Writing cleaned package-lock.json...');
  writeFileSync(lockfilePath, JSON.stringify(cleaned, null, 2) + '\n', 'utf-8');
  
  console.log('✅ Successfully removed all prisma entries from package-lock.json');
}

try {
  main();
} catch (error) {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
