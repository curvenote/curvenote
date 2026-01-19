#!/usr/bin/env node

/**
 * Script to recursively delete all node_modules folders in the repository.
 * Includes a confirmation prompt for safety.
 */

import { readdir, stat, rm } from 'fs/promises';
import { join } from 'path';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function findNodeModulesDirs(dir, baseDir = dir) {
  const dirs = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') {
          dirs.push(fullPath);
        } else {
          // Skip node_modules subdirectories to avoid descending into them
          if (entry.name !== 'node_modules') {
            const subDirs = await findNodeModulesDirs(fullPath, baseDir);
            dirs.push(...subDirs);
          }
        }
      }
    }
  } catch (err) {
    // Ignore permission errors and continue
    if (err.code !== 'EACCES' && err.code !== 'ENOENT') {
      console.error(`Error reading ${dir}:`, err.message);
    }
  }
  return dirs;
}

async function main() {
  console.log('⚠️  This will delete ALL node_modules folders in the repository.');
  console.log('');
  
  const answer = await question('Are you sure? Type "y" to continue: ');
  
  if (answer.trim().toLowerCase() !== 'y') {
    console.log('❌ Cancelled.');
    rl.close();
    process.exit(0);
  }
  
  console.log('');
  console.log('🔍 Searching for node_modules folders...');
  
  const repoRoot = process.cwd();
  const nodeModulesDirs = await findNodeModulesDirs(repoRoot);
  
  if (nodeModulesDirs.length === 0) {
    console.log('✅ No node_modules folders found.');
    rl.close();
    process.exit(0);
  }
  
  console.log(`📦 Found ${nodeModulesDirs.length} node_modules folder(s):`);
  nodeModulesDirs.forEach((dir) => {
    const relativePath = dir.replace(repoRoot, '.').replace(/^\//, '');
    console.log(`   - ${relativePath}`);
  });
  
  console.log('');
  console.log('🗑️  Deleting...');
  
  let deleted = 0;
  let errors = 0;
  
  for (const dir of nodeModulesDirs) {
    try {
      await rm(dir, { recursive: true, force: true });
      deleted++;
      const relativePath = dir.replace(repoRoot, '.').replace(/^\//, '');
      console.log(`   ✓ Deleted ${relativePath}`);
    } catch (err) {
      errors++;
      const relativePath = dir.replace(repoRoot, '.').replace(/^\//, '');
      console.error(`   ✗ Error deleting ${relativePath}: ${err.message}`);
    }
  }
  
  console.log('');
  if (errors === 0) {
    console.log(`✅ Successfully deleted ${deleted} node_modules folder(s).`);
  } else {
    console.log(`⚠️  Deleted ${deleted} folder(s), ${errors} error(s) occurred.`);
    process.exit(1);
  }
  
  rl.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  rl.close();
  process.exit(1);
});
