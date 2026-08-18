#!/usr/bin/env tsx
/**
 * Switch local development storage profile.
 *
 * - Non-secret: platform/scms/.app-config.development.yml
 * - Secret (MinIO keys only): platform/scms/.app-config.secrets.development.yml
 *
 * Usage:
 *   bun run storage:use-minio
 *   bun run storage:use-gcp
 *
 * Does not touch Docker or object data. After switching, reset the DB
 * so seeded WorkVersion.cdn bases match the active knownBucketInfoMap.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { repoRoot } from './assets.shared.mts';

type Profile = 'minio' | 'gcp';

const developmentConfigPath = path.join(repoRoot, 'platform/scms/.app-config.development.yml');
const secretsConfigPath = path.join(repoRoot, 'platform/scms/.app-config.secrets.development.yml');

function parseProfile(argv: string[]): Profile {
  const arg = argv[0];
  if (arg === 'minio' || arg === 'gcp') return arg;
  console.error('Usage: use-storage-profile.mts <minio|gcp>');
  process.exit(1);
}

function fragmentPath(profile: Profile): string {
  return path.join(
    repoRoot,
    'docker/minio',
    profile === 'minio' ? 'storage.minio.yml' : 'storage.gcp.yml',
  );
}

function minioSecretsFragmentPath(): string {
  return path.join(repoRoot, 'docker/minio/storage.minio.secrets.yml');
}

/** Dump a single top-level key as an `api:` child (2-space indent under api). */
function dumpApiChild(key: string, value: unknown): string {
  const raw = yaml.dump(
    { [key]: value },
    { lineWidth: 120, noRefs: true, quotingType: "'", forceQuotes: false },
  );
  return (
    raw
      .trimEnd()
      .split('\n')
      .map((line) => (line.length ? `  ${line}` : line))
      .join('\n') + '\n'
  );
}

/**
 * Replace or remove a key block that is a direct child of `api:` (indent = 2 spaces).
 * `newBlock` is the full indented block including the key line, or null to remove.
 */
function replaceApiChildBlock(doc: string, key: string, newBlock: string | null): string {
  const lines = doc.split('\n');
  const apiIndex = lines.findIndex((line) => /^api:\s*$/.test(line) || /^api:\s*#/.test(line));
  if (apiIndex < 0) {
    throw new Error('Could not find top-level `api:` in app-config');
  }

  // Direct children of api start with exactly two spaces and a non-space key.
  const childRe = /^  ([A-Za-z_][\w]*):/;
  let blockStart = -1;
  let blockEnd = -1;

  for (let i = apiIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    // Left `api` section: next top-level key (no indent)
    if (/^[A-Za-z_]/.test(line)) {
      if (blockStart >= 0 && blockEnd < 0) blockEnd = i;
      break;
    }
    const childMatch = line.match(childRe);
    if (childMatch) {
      if (childMatch[1] === key) {
        blockStart = i;
        continue;
      }
      if (blockStart >= 0 && blockEnd < 0) {
        blockEnd = i;
        break;
      }
    }
  }
  if (blockStart >= 0 && blockEnd < 0) {
    let end = lines.length;
    for (let i = blockStart + 1; i < lines.length; i++) {
      if (/^[A-Za-z_]/.test(lines[i])) {
        end = i;
        break;
      }
    }
    blockEnd = end;
  }

  if (blockStart < 0) {
    if (newBlock == null) return doc;
    let insertAt = apiIndex + 1;
    for (let i = apiIndex + 1; i < lines.length; i++) {
      if (/^[A-Za-z_]/.test(lines[i])) break;
      if (/^  knownBucketInfoMap:/.test(lines[i])) {
        insertAt = i;
        break;
      }
      if (
        /^  privateSiteClaimSubject:/.test(lines[i]) ||
        /^  submissionsServiceAccount:/.test(lines[i]) ||
        /^  privateCDNSigningInfo:/.test(lines[i]) ||
        /^  storageSASecretKeyfile:/.test(lines[i])
      ) {
        insertAt = i;
        break;
      }
      insertAt = i + 1;
    }
    const blockLines = newBlock.replace(/\n$/, '').split('\n');
    return [...lines.slice(0, insertAt), ...blockLines, ...lines.slice(insertAt)].join('\n');
  }

  const before = lines.slice(0, blockStart);
  const after = lines.slice(blockEnd);
  if (newBlock == null) {
    return [...before, ...after].join('\n');
  }
  const blockLines = newBlock.replace(/\n$/, '').split('\n');
  return [...before, ...blockLines, ...after].join('\n');
}

async function main() {
  const profile = parseProfile(process.argv.slice(2));

  try {
    await fs.access(developmentConfigPath);
  } catch {
    console.error(`Missing ${developmentConfigPath}`);
    console.error('Create local development app-config before switching storage profiles.');
    process.exit(1);
  }

  const fragmentRaw = await fs.readFile(fragmentPath(profile), 'utf8');
  const fragment = yaml.load(fragmentRaw) as {
    api?: { storage?: unknown; knownBucketInfoMap?: unknown };
  };
  if (!fragment?.api?.knownBucketInfoMap) {
    throw new Error(`Fragment ${fragmentPath(profile)} missing api.knownBucketInfoMap`);
  }

  let doc = await fs.readFile(developmentConfigPath, 'utf8');

  if (profile === 'minio') {
    if (!fragment.api.storage) {
      throw new Error('storage.minio.yml missing api.storage');
    }
    doc = replaceApiChildBlock(doc, 'storage', dumpApiChild('storage', fragment.api.storage));
  } else {
    doc = replaceApiChildBlock(doc, 'storage', null);
  }

  doc = replaceApiChildBlock(
    doc,
    'knownBucketInfoMap',
    dumpApiChild('knownBucketInfoMap', fragment.api.knownBucketInfoMap),
  );

  await fs.writeFile(developmentConfigPath, doc, 'utf8');

  // MinIO access keys are schema secret:true — must live in secrets file only.
  try {
    await fs.access(secretsConfigPath);
  } catch {
    console.error(`Missing ${secretsConfigPath}`);
    console.error('Create local secrets app-config before switching storage profiles.');
    process.exit(1);
  }

  let secretsDoc = await fs.readFile(secretsConfigPath, 'utf8');
  if (profile === 'minio') {
    const secretsFragmentRaw = await fs.readFile(minioSecretsFragmentPath(), 'utf8');
    const secretsFragment = yaml.load(secretsFragmentRaw) as {
      api?: { storage?: unknown };
    };
    if (!secretsFragment?.api?.storage) {
      throw new Error('storage.minio.secrets.yml missing api.storage');
    }
    secretsDoc = replaceApiChildBlock(
      secretsDoc,
      'storage',
      dumpApiChild('storage', secretsFragment.api.storage),
    );
  } else {
    // Drop MinIO S3 keys so legacy storageSASecretKeyfile path is unambiguous.
    secretsDoc = replaceApiChildBlock(secretsDoc, 'storage', null);
  }
  await fs.writeFile(secretsConfigPath, secretsDoc, 'utf8');

  const prvCdn =
    (fragment.api.knownBucketInfoMap as { prv?: { cdn?: string } })?.prv?.cdn ?? '(unknown)';

  console.log(`✓ Applied ${profile} storage profile`);
  console.log(`  development → ${developmentConfigPath}`);
  console.log(`  secrets     → ${secretsConfigPath}`);
  console.log(`  knownBucketInfoMap.prv.cdn → ${prvCdn}`);
  if (profile === 'minio') {
    console.log('  Next: bun run db:up && bun run storage:seed && bun run dev:db:reset');
  } else {
    console.log('  Next: bun run db:up:gcp && bun run dev:db:reset');
    console.log('  (GCS credentials + privateCDNSigningInfo stay in secrets)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
