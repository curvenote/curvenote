#!/usr/bin/env npx tsx
/**
 * Bulk-register works via POST /v1/etl/register-work.
 *
 * Example:
 *   npx tsx scripts/etl-register-works.ts \
 *     --base-url http://localhost:3032 \
 *     --token "$SCMS_TOKEN" \
 *     --site science \
 *     --registrations 1000 \
 *     --roots 400 \
 *     --concurrency 20
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomInt } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_METADATA = join(__dirname, 'fixtures/workversion.json');

type WorkVersionFixture = {
  extract?: Record<string, unknown>;
  'frontmatter.myst'?: Record<string, unknown>;
};

type DoiEntry = {
  index: number;
  doi: string;
  versions: number;
  targetVersions: number;
  availablePos: number;
};

type PlannedRegistration = {
  doi: string;
  version: number;
  isNewDoi: boolean;
};

type CliOptions = {
  baseUrl: string;
  token: string;
  site: string;
  registrations: number;
  roots: number;
  concurrency: number;
  reuseRate: number;
  cdn: string;
  collection?: string;
  kind?: string;
  metadataPath: string;
  prefix: string;
  runId?: string;
  dryRun: boolean;
};

type RegisterPayload = {
  site: string;
  doi: string;
  title: string;
  cdn: string;
  cdn_key: string;
  collection?: string;
  kind?: string;
  version_tag?: string;
  tags?: string[];
  source?: string;
  contains?: string[];
  description?: string;
  authors?: string[];
  author_details?: Record<string, unknown>[];
  date?: string;
  myst_metadata?: Record<string, unknown>;
  work_metadata?: Record<string, unknown>;
};

function usage(): never {
  console.error(`Usage: npx tsx scripts/etl-register-works.ts [options]

Required:
  --base-url <url>       SCMS base URL (or SCMS_BASE_URL)
  --token <jwt>          Bearer token (or SCMS_TOKEN)
  --site <name>          Target site name (site admin required)

Volume:
  --registrations <n>    Total register-work POSTs (default: 100)
  --roots <n>            Max unique DOIs in the pool (default: registrations)

Behaviour:
  --reuse-rate <0-1>     Chance to add a version to an existing DOI (default: 0.6)
  --concurrency <n>      Parallel requests (default: 10)
  --prefix <string>      DOI prefix base (default: 10.5072/etl-bench)
  --run-id <string>      Run segment appended to prefix (default: auto-generated)
  --no-randomize-prefix   Use --prefix as-is (reruns may skip existing DOIs)

Payload:
  --cdn <url>            CDN base URL (default: https://prv.curvenote.dev/)
  --collection <name>    Submission collection (default: articles)
  --kind <name>          Submission kind (default: article)
  --metadata <path>      Work version metadata JSON (default: scripts/fixtures/workversion.json)

Other:
  --dry-run              Print planned distribution only
  --help                 Show this help
`);
  process.exit(1);
}

function createRunId(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${stamp}-${randomBytes(3).toString('hex')}`;
}

function resolveDoiPrefix(
  basePrefix: string,
  options: { runId?: string; randomize: boolean },
): { prefix: string; runId?: string } {
  const base = basePrefix.replace(/\/+$/, '');
  if (!options.randomize) {
    return { prefix: base };
  }
  const runId = options.runId?.trim() || createRunId();
  return { prefix: `${base}/${runId}`, runId };
}

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();
  const flags = new Set<string>();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage();
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        flags.add(key);
      } else {
        args.set(key, next);
        i += 1;
      }
    }
  }

  const registrations = Number(args.get('registrations') ?? '100');
  const roots = Number(args.get('roots') ?? String(registrations));
  const concurrency = Number(args.get('concurrency') ?? '10');
  const reuseRate = Number(args.get('reuse-rate') ?? '0.6');

  if (!Number.isFinite(registrations) || registrations < 1) {
    throw new Error('--registrations must be a positive integer');
  }
  if (!Number.isFinite(roots) || roots < 1) {
    throw new Error('--roots must be a positive integer');
  }
  if (roots > registrations) {
    throw new Error('--roots cannot exceed --registrations');
  }
  if (registrations > roots * 5) {
    throw new Error('--registrations cannot exceed roots * 5 (max 5 versions per DOI)');
  }
  if (!Number.isFinite(concurrency) || concurrency < 1) {
    throw new Error('--concurrency must be a positive integer');
  }
  if (!Number.isFinite(reuseRate) || reuseRate < 0 || reuseRate > 1) {
    throw new Error('--reuse-rate must be between 0 and 1');
  }

  const baseUrl = (args.get('base-url') ?? process.env.SCMS_BASE_URL ?? '').replace(/\/$/, '');
  const token = args.get('token') ?? process.env.SCMS_TOKEN ?? '';
  const site = args.get('site') ?? process.env.SCMS_SITE ?? '';

  if (!baseUrl) throw new Error('Missing --base-url (or SCMS_BASE_URL)');
  if (!token) throw new Error('Missing --token (or SCMS_TOKEN)');
  if (!site) throw new Error('Missing --site (or SCMS_SITE)');

  const randomizePrefix =
    !flags.has('no-randomize-prefix') && process.env.ETL_RANDOMIZE_PREFIX !== '0';
  const basePrefix = args.get('prefix') ?? process.env.ETL_PREFIX ?? '10.5072/etl-bench';
  const runIdArg = args.get('run-id') ?? process.env.ETL_RUN_ID;
  const { prefix, runId } = resolveDoiPrefix(basePrefix, {
    runId: runIdArg,
    randomize: randomizePrefix,
  });

  return {
    baseUrl,
    token,
    site,
    registrations,
    roots,
    concurrency,
    reuseRate,
    cdn: args.get('cdn') ?? 'https://prv.curvenote.dev/',
    collection: args.get('collection'),
    kind: args.get('kind'),
    metadataPath: resolve(args.get('metadata') ?? DEFAULT_METADATA),
    prefix,
    runId,
    dryRun: flags.has('dry-run'),
  };
}

function loadMetadata(path: string): {
  work_metadata: Record<string, unknown>;
  myst_metadata: Record<string, unknown>;
  title: string;
  description?: string;
  authors?: string[];
  author_details?: Record<string, unknown>[];
  date?: string;
} {
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as WorkVersionFixture;
  const myst = raw['frontmatter.myst'];
  if (!myst || typeof myst !== 'object') {
    throw new Error(`Metadata file missing frontmatter.myst: ${path}`);
  }
  const project = (myst as { project?: Record<string, unknown> }).project ?? {};
  const authorDetails = Array.isArray(project.authors)
    ? (project.authors as Record<string, unknown>[])
    : undefined;
  const authors = authorDetails
    ?.map((author) => author.name)
    .filter((name): name is string => typeof name === 'string' && name.length > 0);

  return {
    work_metadata: raw.extract ? { extract: raw.extract } : {},
    myst_metadata: structuredClone(myst) as Record<string, unknown>,
    title: typeof project.title === 'string' ? project.title : 'Untitled work',
    description: typeof project.description === 'string' ? project.description : undefined,
    authors,
    author_details: authorDetails,
    date: typeof project.date === 'string' ? project.date : undefined,
  };
}

function removeAvailable(available: number[], entries: DoiEntry[], entry: DoiEntry) {
  if (entry.availablePos < 0) return;
  const pos = entry.availablePos;
  const lastIndex = available.pop()!;
  if (pos < available.length) {
    available[pos] = lastIndex;
    entries[lastIndex]!.availablePos = pos;
  }
  entry.availablePos = -1;
}

function pickReuseEntry(entries: DoiEntry[], available: number[]): DoiEntry | undefined {
  if (available.length === 0) return undefined;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const entry = entries[available[randomInt(0, available.length)]!]!;
    if (entry.versions < entry.targetVersions) return entry;
  }

  return entries[available[randomInt(0, available.length)]!]!;
}

function planRegistrations(opts: CliOptions): {
  plan: PlannedRegistration[];
  histogram: Map<number, number>;
} {
  const entries: DoiEntry[] = [];
  const available: number[] = [];
  const plan: PlannedRegistration[] = [];
  let nextRootIndex = 0;

  for (let i = 0; i < opts.registrations; i += 1) {
    const canCreate = entries.length < opts.roots;
    const reuseEntry = pickReuseEntry(entries, available);
    const shouldReuse =
      reuseEntry && (!canCreate || Math.random() < opts.reuseRate);

    let entry: DoiEntry;
    let isNewDoi = false;

    if (shouldReuse && reuseEntry) {
      entry = reuseEntry;
    } else if (canCreate) {
      const doi = `${opts.prefix}/${String(nextRootIndex).padStart(8, '0')}`;
      nextRootIndex += 1;
      entry = {
        index: entries.length,
        doi,
        versions: 0,
        targetVersions: randomInt(1, 6),
        availablePos: available.length,
      };
      entries.push(entry);
      available.push(entry.index);
      isNewDoi = true;
    } else if (reuseEntry) {
      entry = reuseEntry;
    } else {
      throw new Error(
        `Unable to plan registrations: need ${opts.registrations} slots but only ${entries.length * 5} available at 5 versions/DOI`,
      );
    }

    entry.versions += 1;
    if (entry.versions >= 5) removeAvailable(available, entries, entry);
    plan.push({ doi: entry.doi, version: entry.versions, isNewDoi });
  }

  const histogram = new Map<number, number>();
  for (const entry of entries) {
    if (entry.versions > 0) {
      histogram.set(entry.versions, (histogram.get(entry.versions) ?? 0) + 1);
    }
  }

  return { plan, histogram };
}

function buildPayload(
  opts: CliOptions,
  metadata: ReturnType<typeof loadMetadata>,
  doi: string,
  version: number,
): RegisterPayload {
  const versionTag = `v${version}`;
  const title = version === 1 ? metadata.title : `${metadata.title} (revision ${version})`;

  return {
    site: opts.site,
    doi,
    title,
    cdn: opts.cdn,
    cdn_key: crypto.randomUUID(),
    collection: opts.collection,
    kind: opts.kind,
    version_tag: versionTag,
    tags: [versionTag],
    source: 'myst',
    contains: ['myst'],
    description: metadata.description,
    authors: metadata.authors,
    author_details: metadata.author_details,
    date: metadata.date,
    myst_metadata: metadata.myst_metadata,
    work_metadata: metadata.work_metadata,
  };
}

async function registerWork(
  opts: CliOptions,
  payload: RegisterPayload,
): Promise<'created' | 'skipped'> {
  const response = await fetch(`${opts.baseUrl}/v1/etl/register-work`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 201) return 'created';
  if (response.status === 200) return 'skipped';

  const body = await response.text().catch(() => '');
  throw new Error(`HTTP ${response.status}${body ? `: ${body}` : ''}`);
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      await worker(items[index]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runner()));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const metadata = loadMetadata(opts.metadataPath);

  if (opts.runId) {
    console.log(`DOI prefix: ${opts.prefix} (run ${opts.runId})`);
  } else {
    console.log(`DOI prefix: ${opts.prefix}`);
  }
  console.log(`Planning ${opts.registrations} registrations (max ${opts.roots} roots)...`);
  const planStarted = Date.now();
  const { plan, histogram } = planRegistrations(opts);
  const uniqueDois = [...histogram.values()].reduce((sum, count) => sum + count, 0);
  console.log(
    `Planned in ${((Date.now() - planStarted) / 1000).toFixed(1)}s: ${plan.length} registrations across ${uniqueDois} DOIs`,
  );
  console.log(
    'Versions per DOI:',
    [...histogram.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([versions, count]) => `${versions}:${count}`)
      .join(', '),
  );

  if (opts.dryRun) {
    console.log('Dry run only — no requests sent.');
    return;
  }

  const stats = {
    created: 0,
    skipped: 0,
    failed: 0,
    newDois: plan.filter((item) => item.isNewDoi).length,
    versionAdds: plan.filter((item) => !item.isNewDoi).length,
  };

  const started = Date.now();
  let completed = 0;
  const logEvery = Math.max(1, Math.floor(plan.length / 20));

  await runPool(plan, opts.concurrency, async (item) => {
    const payload = buildPayload(opts, metadata, item.doi, item.version);
    try {
      const result = await registerWork(opts, payload);
      if (result === 'created') stats.created += 1;
      else stats.skipped += 1;
    } catch (error) {
      stats.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed ${item.doi} ${payload.version_tag}: ${message}`);
    } finally {
      completed += 1;
      if (completed % logEvery === 0 || completed === plan.length) {
        const elapsed = ((Date.now() - started) / 1000).toFixed(1);
        console.log(
          `Progress ${completed}/${plan.length} (${elapsed}s) created=${stats.created} skipped=${stats.skipped} failed=${stats.failed}`,
        );
      }
    }
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log('\nDone.');
  console.log(`  created:  ${stats.created}`);
  console.log(`  skipped:  ${stats.skipped}`);
  console.log(`  failed:   ${stats.failed}`);
  console.log(`  new DOIs: ${stats.newDois}`);
  console.log(`  adds:     ${stats.versionAdds}`);
  console.log(`  elapsed:  ${elapsed}s`);
  if (stats.failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
