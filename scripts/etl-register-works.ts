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

type DoiMetadata = {
  title: string;
  authors: string[];
  author_details: Record<string, unknown>[];
};

type DoiEntry = {
  index: number;
  doi: string;
  versions: number;
  targetVersions: number;
  availablePos: number;
  title: string;
  authors: string[];
  author_details: Record<string, unknown>[];
};

type PlannedRegistration = {
  doi: string;
  version: number;
  isNewDoi: boolean;
  title: string;
  authors: string[];
  author_details: Record<string, unknown>[];
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
  randomizeMetadata: boolean;
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
  --no-randomize-metadata  Use fixture title/authors for every registration
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
  const randomizeMetadata =
    !flags.has('no-randomize-metadata') && process.env.ETL_RANDOMIZE_METADATA !== '0';

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
    randomizeMetadata,
    progressEvery,
    progressIntervalSec,
    dryRun: flags.has('dry-run'),
  };
}

const TITLE_SUBJECTS = [
  'Spatial',
  'Temporal',
  'Bayesian',
  'Neural',
  'Genomic',
  'Structural',
  'Computational',
  'Stochastic',
];
const TITLE_ADJECTIVES = [
  'dynamics',
  'inference',
  'modeling',
  'analysis',
  'mapping',
  'simulation',
  'characterization',
  'integration',
];
const TITLE_NOUNS = [
  'cohorts',
  'networks',
  'pathways',
  'signals',
  'ensembles',
  'landscapes',
  'regimes',
  'workflows',
];
const TITLE_CONTEXTS = [
  'synthetic benchmarks',
  'high-throughput assays',
  'multi-omic panels',
  'reproducible pipelines',
  'controlled experiments',
];

const GIVEN_NAMES = [
  'Taylor',
  'Robin',
  'Jordan',
  'Alex',
  'Sam',
  'Casey',
  'Morgan',
  'Riley',
  'Quinn',
  'Avery',
];
const FAMILY_NAMES = [
  'Morgan',
  'Patel',
  'Chen',
  'Nguyen',
  'Brooks',
  'Singh',
  'Kim',
  'Rivera',
  'Okafor',
  'Hayes',
];
const AFFILIATIONS = [
  'Center for Synthetic Data Engineering',
  'Department of Example Analytics, North Example University',
  'Institute for Benchmark Studies',
  'Laboratory of Computational Methods',
  'School of Applied Statistics',
];

function pickOne<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length)]!;
}

function randomTitle(): string {
  const pattern = randomInt(0, 2);
  if (pattern === 0) {
    return `${pickOne(TITLE_SUBJECTS)} ${pickOne(TITLE_ADJECTIVES)} of ${pickOne(TITLE_NOUNS)} in ${pickOne(TITLE_CONTEXTS)}`;
  }
  if (pattern === 1) {
    return `${pickOne(TITLE_ADJECTIVES)} ${pickOne(TITLE_NOUNS)} for ${pickOne(TITLE_CONTEXTS)}`;
  }
  return `${pickOne(TITLE_SUBJECTS)} ${pickOne(TITLE_NOUNS)} under ${pickOne(TITLE_ADJECTIVES)} constraints`;
}

function randomAffiliation(): string {
  return pickOne(AFFILIATIONS);
}

function randomAuthors(): DoiMetadata {
  const count = randomInt(1, 4);
  const author_details: Record<string, unknown>[] = [];
  const authors: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const given = pickOne(GIVEN_NAMES);
    const family = pickOne(FAMILY_NAMES);
    const name = `${given} ${family}`;
    const detail: Record<string, unknown> = {
      id: `contributors-etl-${randomBytes(4).toString('hex')}`,
      name,
      affiliation: randomAffiliation(),
      nameParsed: { given, family, literal: name },
    };
    if (randomInt(0, 10) < 3) {
      detail.orcid = `0000-0000-0000-${String(randomInt(0, 10000)).padStart(4, '0')}`;
    }
    author_details.push(detail);
    authors.push(name);
  }

  return { title: randomTitle(), authors, author_details };
}

function fixtureDoiMetadata(metadata: ReturnType<typeof loadMetadata>): DoiMetadata {
  return {
    title: metadata.title,
    authors: metadata.authors ?? [],
    author_details: structuredClone(metadata.author_details ?? []),
  };
}

function titleForVersion(baseTitle: string, version: number): string {
  return version === 1 ? baseTitle : `${baseTitle} (revision ${version})`;
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

function createRegistrationPlan(
  opts: CliOptions,
  fixtureMetadata: DoiMetadata,
): {
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
      const doiMeta = opts.randomizeMetadata
        ? randomAuthors()
        : {
            title: fixtureMetadata.title,
            authors: [...fixtureMetadata.authors],
            author_details: structuredClone(fixtureMetadata.author_details),
          };
      entry = {
        index: entries.length,
        doi,
        versions: 0,
        targetVersions: randomInt(1, 6),
        availablePos: available.length,
        title: doiMeta.title,
        authors: doiMeta.authors,
        author_details: doiMeta.author_details,
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

    const title = titleForVersion(entry.title, entry.versions);
    return {
      doi: entry.doi,
      version: entry.versions,
      isNewDoi,
      title,
      authors: entry.authors,
      author_details: entry.author_details,
    };
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
  item: PlannedRegistration,
): RegisterPayload {
  const versionTag = `v${item.version}`;
  const myst_metadata = structuredClone(metadata.myst_metadata) as Record<string, unknown>;
  const project = (myst_metadata.project ?? {}) as Record<string, unknown>;
  project.title = item.title;
  project.authors = structuredClone(item.author_details);
  myst_metadata.project = project;

  return {
    site: opts.site,
    doi: item.doi,
    title: item.title,
    cdn: opts.cdn,
    cdn_key: crypto.randomUUID(),
    collection: opts.collection,
    kind: opts.kind,
    version_tag: versionTag,
    source: 'myst',
    contains: ['myst'],
    description: metadata.description,
    authors: item.authors,
    author_details: structuredClone(item.author_details),
    date: metadata.date,
    myst_metadata,
    work_metadata: metadata.work_metadata,
    submission_metadata: submissionMetadata,
  };
}

async function drainResponse(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
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

  // Synchronous dequeue: plan.next() is sync, and Node won't interleave other
  // tasks until we await worker(), so no promise-chain lock is needed.
  function takeNext(): PlannedRegistration | undefined {
    if (nextIndex >= total) return undefined;
    nextIndex += 1;
    return nextItem();
  }

  async function runner() {
    while (true) {
      const item = takeNext();
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
  if (opts.randomizeMetadata) {
    const sample = randomAuthors();
    console.log(`Metadata: randomized per DOI (sample title: "${sample.title}", authors: ${sample.authors.join(', ')})`);
  } else {
    console.log('Metadata: using fixture title/authors for all registrations');
  }
  console.log(`Planning ${opts.registrations} registrations (max ${opts.roots} roots)...`);
  const planStarted = Date.now();
  const plan = createRegistrationPlan(opts, fixtureDoiMetadata(metadata));

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
    const payload = buildPayload(opts, metadata, submissionMetadata, item);
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
