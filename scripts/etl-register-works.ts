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
const DEFAULT_SUBMISSION_METADATA = join(__dirname, 'fixtures/submissionversion.json');

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
  submissionMetadataPath: string;
  prefix: string;
  runId?: string;
  progressEvery: number;
  progressIntervalSec: number;
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
  source?: string;
  contains?: string[];
  description?: string;
  authors?: string[];
  author_details?: Record<string, unknown>[];
  date?: string;
  myst_metadata?: Record<string, unknown>;
  work_metadata?: Record<string, unknown>;
  submission_metadata?: Record<string, unknown>;
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
  --progress-every <n>   Log every N completions (default: scales with job size)
  --progress-interval <sec>  Min seconds between progress logs for large jobs (default: 15)

Payload:
  --cdn <url>            CDN base URL (default: https://prv.curvenote.dev/)
  --collection <name>    Submission collection (default: articles)
  --kind <name>          Submission kind (default: article)
  --metadata <path>      Work version metadata JSON (default: scripts/fixtures/workversion.json)
  --submission-metadata <path>  Submission version metadata JSON (default: scripts/fixtures/submissionversion.json)

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

function defaultProgressEvery(total: number): number {
  if (total <= 100) return Math.max(1, Math.floor(total / 10));
  if (total <= 1000) return Math.max(1, Math.floor(total / 20));
  return Math.max(50, Math.floor(total / 40));
}

function parseProgressEvery(raw: string | undefined, total: number): number {
  if (!raw) return defaultProgressEvery(total);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) {
    throw new Error('--progress-every must be a positive integer');
  }
  return Math.floor(value);
}

function parseProgressIntervalSec(raw: string | undefined): number {
  if (!raw) return 15;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('--progress-interval must be a non-negative number');
  }
  return value;
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
  const progressEvery = parseProgressEvery(
    args.get('progress-every') ?? process.env.ETL_PROGRESS_EVERY,
    registrations,
  );
  const progressIntervalSec = parseProgressIntervalSec(
    args.get('progress-interval') ?? process.env.ETL_PROGRESS_INTERVAL,
  );

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
    metadataPath: resolve(args.get('metadata') ?? process.env.ETL_METADATA ?? DEFAULT_METADATA),
    submissionMetadataPath: resolve(
      args.get('submission-metadata') ??
        process.env.ETL_SUBMISSION_METADATA ??
        DEFAULT_SUBMISSION_METADATA,
    ),
    prefix,
    runId,
    progressEvery,
    progressIntervalSec,
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

function loadSubmissionMetadata(path: string): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Submission metadata file must contain a JSON object: ${path}`);
  }
  return structuredClone(raw) as Record<string, unknown>;
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

type PlanSummary = {
  histogram: Map<number, number>;
  newDois: number;
  versionAdds: number;
  uniqueDois: number;
};

function createRegistrationPlan(opts: CliOptions): {
  next: () => PlannedRegistration | undefined;
  summary: () => PlanSummary;
} {
  const entries: DoiEntry[] = [];
  const available: number[] = [];
  let nextRootIndex = 0;
  let produced = 0;
  let newDois = 0;
  let versionAdds = 0;

  function next(): PlannedRegistration | undefined {
    if (produced >= opts.registrations) return undefined;

    const canCreate = entries.length < opts.roots;
    const reuseEntry = pickReuseEntry(entries, available);
    const shouldReuse = reuseEntry && (!canCreate || Math.random() < opts.reuseRate);

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
    produced += 1;
    if (isNewDoi) newDois += 1;
    else versionAdds += 1;

    return { doi: entry.doi, version: entry.versions, isNewDoi };
  }

  function summary(): PlanSummary {
    const histogram = new Map<number, number>();
    for (const entry of entries) {
      if (entry.versions > 0) {
        histogram.set(entry.versions, (histogram.get(entry.versions) ?? 0) + 1);
      }
    }
    const uniqueDois = [...histogram.values()].reduce((sum, count) => sum + count, 0);
    return { histogram, newDois, versionAdds, uniqueDois };
  }

  return { next, summary };
}

function buildPayload(
  opts: CliOptions,
  metadata: ReturnType<typeof loadMetadata>,
  submissionMetadata: Record<string, unknown>,
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
    source: 'myst',
    contains: ['myst'],
    description: metadata.description,
    authors: metadata.authors,
    author_details: metadata.author_details,
    date: metadata.date,
    myst_metadata: metadata.myst_metadata,
    work_metadata: metadata.work_metadata,
    submission_metadata: submissionMetadata,
  };
}

async function drainResponse(response: Response): Promise<void> {
  try {
    await response.arrayBuffer();
  } catch {
    await response.body?.cancel().catch(() => undefined);
  }
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

  if (response.status === 201) {
    await drainResponse(response);
    return 'created';
  }
  if (response.status === 200) {
    await drainResponse(response);
    return 'skipped';
  }

  const body = (await response.text().catch(() => '')).slice(0, 500);
  throw new Error(`HTTP ${response.status}${body ? `: ${body}` : ''}`);
}

async function runPool(
  total: number,
  concurrency: number,
  nextItem: () => PlannedRegistration | undefined,
  worker: (item: PlannedRegistration) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  let planLock: Promise<void> = Promise.resolve();

  function takeNext(): Promise<PlannedRegistration | undefined> {
    const itemPromise = planLock.then(() => {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= total) return undefined;
      return nextItem();
    });
    planLock = itemPromise.then(() => undefined);
    return itemPromise;
  }

  async function runner() {
    while (true) {
      const item = await takeNext();
      if (!item) return;
      await worker(item);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => runner()));
}

type RunStats = {
  created: number;
  skipped: number;
  failed: number;
};

function logProgress(completed: number, total: number, startedMs: number, stats: RunStats): void {
  const elapsedSec = (Date.now() - startedMs) / 1000;
  const rate = elapsedSec > 0 ? completed / elapsedSec : 0;
  const remaining = total - completed;
  const etaSec = rate > 0 ? remaining / rate : 0;
  const pct = total > 0 ? ((completed / total) * 100).toFixed(1) : '100.0';

  console.log(
    `Progress ${completed}/${total} (${pct}%) | ${elapsedSec.toFixed(0)}s elapsed | ${rate.toFixed(1)}/s` +
      (completed < total ? ` | ETA ${etaSec.toFixed(0)}s` : '') +
      ` | created=${stats.created} skipped=${stats.skipped} failed=${stats.failed}`,
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const metadata = loadMetadata(opts.metadataPath);
  const submissionMetadata = loadSubmissionMetadata(opts.submissionMetadataPath);

  if (opts.runId) {
    console.log(`DOI prefix: ${opts.prefix} (run ${opts.runId})`);
  } else {
    console.log(`DOI prefix: ${opts.prefix}`);
  }
  console.log(`Planning ${opts.registrations} registrations (max ${opts.roots} roots)...`);
  const planStarted = Date.now();
  const plan = createRegistrationPlan(opts);

  if (opts.dryRun) {
    while (plan.next()) {
      // Consume the plan without storing registrations in memory.
    }
    const { histogram, uniqueDois } = plan.summary();
    console.log(
      `Planned in ${((Date.now() - planStarted) / 1000).toFixed(1)}s: ${opts.registrations} registrations across ${uniqueDois} DOIs`,
    );
    console.log(
      'Versions per DOI:',
      [...histogram.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([versions, count]) => `${versions}:${count}`)
        .join(', '),
    );
    console.log('Dry run only — no requests sent.');
    return;
  }

  const stats: RunStats = {
    created: 0,
    skipped: 0,
    failed: 0,
  };

  const started = Date.now();
  let completed = 0;
  let lastProgressAt = started;
  const progressIntervalMs = opts.registrations > 1000 ? opts.progressIntervalSec * 1000 : 0;

  console.log(
    `Registering ${opts.registrations} works (max ${opts.roots} unique DOIs, concurrency ${opts.concurrency})...`,
  );

  if (opts.registrations > 1000) {
    console.log(
      `Progress updates every ~${opts.progressEvery} registrations or ${opts.progressIntervalSec}s`,
    );
  }

  logProgress(0, opts.registrations, started, stats);

  await runPool(opts.registrations, opts.concurrency, plan.next, async (item) => {
    const payload = buildPayload(opts, metadata, submissionMetadata, item.doi, item.version);
    try {
      const result = await registerWork(opts, payload);
      if (result === 'created') stats.created += 1;
      else stats.skipped += 1;
    } catch (error) {
      stats.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed ${item.doi} v${item.version}: ${message}`);
    } finally {
      completed += 1;
      const now = Date.now();
      const countMilestone = completed % opts.progressEvery === 0;
      const timeMilestone = progressIntervalMs > 0 && now - lastProgressAt >= progressIntervalMs;
      const finished = completed === opts.registrations;

      if (countMilestone || timeMilestone || finished) {
        lastProgressAt = now;
        logProgress(completed, opts.registrations, started, stats);
      }
    }
  });

  const { newDois, versionAdds } = plan.summary();
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log('\nDone.');
  console.log(`  created:  ${stats.created}`);
  console.log(`  skipped:  ${stats.skipped}`);
  console.log(`  failed:   ${stats.failed}`);
  console.log(`  new DOIs: ${newDois}`);
  console.log(`  adds:     ${versionAdds}`);
  console.log(`  elapsed:  ${elapsed}s`);
  if (stats.failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
