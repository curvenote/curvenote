#!/usr/bin/env npx tsx
/**
 * Copy works (and related rows) from a remote staging Postgres DB into local dev.
 *
 * Typical setup (Supabase staging → local Docker Postgres):
 *   STAGING_DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/scms
 *
 * Example:
 *   npx tsx scripts/pull-staging-site-data.ts \
 *     --source-site openrxiv \
 *     --target-site openrxiv \
 *     --limit 1000
 */

import { createPrismaClient, disconnectPrisma, type PrismaDb } from './lib/prisma-connection.js';

type CliOptions = {
  sourceSite: string;
  targetSite: string;
  limit: number;
  dryRun: boolean;
  replace: boolean;
  includeActivity: boolean;
  includeJobs: boolean;
  includeChecks: boolean;
  stagingUrl: string;
  localUrl: string;
  stagingSslInsecure: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const has = (flag: string) => argv.includes(flag);

  const sourceSite = get('--source-site') ?? process.env.PULL_SOURCE_SITE;
  const targetSite = get('--target-site') ?? process.env.PULL_TARGET_SITE ?? sourceSite;
  const limitRaw = get('--limit') ?? process.env.PULL_LIMIT ?? '1000';
  const stagingUrl = get('--staging-url') ?? process.env.STAGING_DATABASE_URL;
  const localUrl = get('--local-url') ?? process.env.DATABASE_URL;

  if (!sourceSite) {
    throw new Error('Missing --source-site (staging site name)');
  }
  if (!targetSite) {
    throw new Error('Missing --target-site (local site name)');
  }
  if (!stagingUrl) {
    throw new Error('Missing STAGING_DATABASE_URL or --staging-url');
  }
  if (!localUrl) {
    throw new Error('Missing DATABASE_URL or --local-url');
  }

  const limit = Number.parseInt(limitRaw, 10);
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error(`Invalid --limit: ${limitRaw}`);
  }

  return {
    sourceSite,
    targetSite,
    limit,
    dryRun: has('--dry-run') || process.env.PULL_DRY_RUN === '1',
    replace: has('--replace') || process.env.PULL_REPLACE === '1',
    includeActivity: !has('--no-activity') && process.env.PULL_NO_ACTIVITY !== '1',
    includeJobs: !has('--no-jobs') && process.env.PULL_NO_JOBS !== '1',
    includeChecks: !has('--no-checks') && process.env.PULL_NO_CHECKS !== '1',
    stagingUrl,
    localUrl,
    stagingSslInsecure:
      has('--staging-ssl-insecure') || process.env.STAGING_DATABASE_SSL_INSECURE === '1',
  };
}

function unique<T>(values: Iterable<T | null | undefined>): T[] {
  return [...new Set([...values].filter((v): v is T => v != null))];
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    map.set(row.id, row);
  }
  return [...map.values()];
}

async function resolveSite(db: PrismaDb, name: string, label: string) {
  const site = await db.site.findUnique({
    where: { name },
    select: {
      id: true,
      name: true,
      title: true,
      submissionKinds: { select: { id: true, name: true } },
      collections: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!site) {
    throw new Error(`${label} site not found: ${name}`);
  }
  return site;
}

function buildNameMap<T extends { id: string; name: string }>(rows: T[]): Map<string, string> {
  return new Map(rows.map((r) => [r.name, r.id]));
}

async function selectWorkIds(
  staging: PrismaDb,
  sourceSiteId: string,
  limit: number,
): Promise<string[]> {
  const groups = await staging.submission.groupBy({
    by: ['work_id'],
    where: { site_id: sourceSiteId, work_id: { not: null } },
    _max: { date_modified: true },
    orderBy: { _max: { date_modified: 'desc' } },
    take: limit,
  });
  return unique(groups.map((g) => g.work_id));
}

type PullBundle = Awaited<ReturnType<typeof fetchBundle>>;

async function fetchBundle(
  staging: PrismaDb,
  sourceSiteId: string,
  workIds: string[],
  opts: Pick<CliOptions, 'includeActivity' | 'includeJobs' | 'includeChecks'>,
) {
  if (workIds.length === 0) {
    return {
      works: [],
      users: [],
      jobs: [],
      linkedJobs: [],
      checkRuns: [],
      activities: [],
      accesses: [],
      stagingKindNames: new Map<string, string>(),
      stagingCollectionNames: new Map<string, string>(),
      submissionIds: [] as string[],
      workVersionIds: [] as string[],
    };
  }

  const works = await staging.work.findMany({
    where: { id: { in: workIds } },
    include: {
      versions: true,
      work_users: true,
      access: true,
      submissions: {
        where: { site_id: sourceSiteId },
        include: {
          versions: true,
          slugs: true,
          activity: opts.includeActivity,
        },
      },
      activity: opts.includeActivity
        ? {
            where: {
              OR: [{ site_id: sourceSiteId }, { work_id: { in: workIds } }],
            },
          }
        : false,
    },
  });

  const submissionIds = unique(works.flatMap((w) => w.submissions.map((s) => s.id)));
  const submissionVersionIds = unique(
    works.flatMap((w) => w.submissions.flatMap((s) => s.versions.map((v) => v.id))),
  );
  const workVersionIds = unique(works.flatMap((w) => w.versions.map((v) => v.id)));

  const stagingKinds = await staging.submissionKind.findMany({
    where: {
      id: {
        in: unique(works.flatMap((w) => w.submissions.map((s) => s.kind_id))),
      },
    },
    select: { id: true, name: true },
  });
  const stagingCollections = await staging.collection.findMany({
    where: {
      id: {
        in: unique(works.flatMap((w) => w.submissions.map((s) => s.collection_id))),
      },
    },
    select: { id: true, name: true },
  });

  const stagingKindNames = new Map(stagingKinds.map((k) => [k.id, k.name]));
  const stagingCollectionNames = new Map(stagingCollections.map((c) => [c.id, c.name]));

  const userIds = unique([
    ...works.map((w) => w.created_by_id),
    ...works.flatMap((w) => w.work_users.map((wu) => wu.user_id)),
    ...works.flatMap((w) => w.submissions.map((s) => s.submitted_by_id)),
    ...works.flatMap((w) =>
      w.submissions.flatMap((s) => s.versions.map((v) => v.submitted_by_id)),
    ),
    ...works.flatMap((w) => (w.activity ?? []).map((a) => a.activity_by_id)),
    ...works.flatMap((w) =>
      w.submissions.flatMap((s) => (s.activity ?? []).map((a) => a.activity_by_id)),
    ),
    ...works.flatMap((w) => w.access.map((a) => a.owner_id)),
    ...works.flatMap((w) => w.access.map((a) => a.receiver_id)),
  ]);

  const users = await staging.user.findMany({ where: { id: { in: userIds } } });

  const jobs =
    opts.includeJobs && submissionVersionIds.length > 0
      ? await staging.job.findMany({
          where: {
            SubmissionVersion: { some: { id: { in: submissionVersionIds } } },
          },
        })
      : [];

  const linkedJobs =
    opts.includeJobs && workVersionIds.length > 0
      ? await staging.linkedJob.findMany({
          where: { work_version_id: { in: workVersionIds } },
        })
      : [];

  const checkRuns =
    opts.includeChecks && workVersionIds.length > 0
      ? await staging.checkServiceRun.findMany({
          where: { work_version_id: { in: workVersionIds } },
        })
      : [];

  const siteAccess = await staging.access.findMany({
    where: {
      OR: [{ work_id: { in: workIds } }, { site_id: sourceSiteId, work_id: null }],
    },
  });

  const extraActivities =
    opts.includeActivity && submissionIds.length > 0
      ? await staging.activity.findMany({
          where: {
            submission_id: { in: submissionIds },
            work_id: { notIn: workIds },
          },
        })
      : [];

  const activities = dedupeById([
    ...works.flatMap((w) => w.activity ?? []),
    ...works.flatMap((w) => w.submissions.flatMap((s) => s.activity ?? [])),
    ...extraActivities,
  ]);

  const accesses = dedupeById([...works.flatMap((w) => w.access), ...siteAccess]);

  return {
    works,
    users,
    jobs,
    linkedJobs,
    checkRuns,
    activities,
    accesses,
    stagingKindNames,
    stagingCollectionNames,
    submissionIds,
    workVersionIds,
  };
}

function remapSubmissionRow(
  submission: PullBundle['works'][0]['submissions'][0],
  targetSiteId: string,
  kindId: string,
  collectionId: string,
) {
  const { activity: _a, versions: _v, slugs: _s, ...row } = submission;
  return {
    ...row,
    site_id: targetSiteId,
    kind_id: kindId,
    collection_id: collectionId,
  };
}

function remapAccessRow(
  access: PullBundle['accesses'][0],
  targetSiteId: string,
  sourceSiteId: string,
) {
  const { activity: _a, ...row } = access as typeof access & { activity?: unknown };
  return {
    ...row,
    site_id: row.site_id === sourceSiteId ? targetSiteId : row.site_id,
  };
}

function stripRelations<T extends Record<string, unknown>>(row: T, keys: string[]): Omit<T, string> {
  const out = { ...row };
  for (const key of keys) {
    delete out[key];
  }
  return out as Omit<T, string>;
}

async function purgeLocalCopies(
  local: PrismaDb,
  targetSiteId: string,
  workIds: string[],
  submissionIds: string[],
) {
  if (submissionIds.length > 0) {
    await local.activity.deleteMany({ where: { submission_id: { in: submissionIds } } });
    await local.slug.deleteMany({ where: { submission_id: { in: submissionIds } } });
    await local.submissionVersion.deleteMany({
      where: { submission_id: { in: submissionIds } },
    });
    await local.submission.deleteMany({ where: { id: { in: submissionIds } } });
  }

  if (workIds.length > 0) {
    await local.activity.deleteMany({ where: { work_id: { in: workIds } } });
    await local.access.deleteMany({ where: { work_id: { in: workIds } } });
    await local.checkServiceRun.deleteMany({
      where: { work_version: { work_id: { in: workIds } } },
    });
    await local.linkedJob.deleteMany({
      where: { work_version: { work_id: { in: workIds } } },
    });
    await local.workUser.deleteMany({ where: { work_id: { in: workIds } } });
    await local.workVersion.deleteMany({ where: { work_id: { in: workIds } } });
    await local.work.deleteMany({ where: { id: { in: workIds } } });
  }

  await local.access.deleteMany({
    where: { site_id: targetSiteId, work_id: null },
  });
}

async function importBundle(
  local: PrismaDb,
  bundle: PullBundle,
  maps: {
    targetSiteId: string;
    sourceSiteId: string;
    kindIdByStagingId: Map<string, string>;
    collectionIdByStagingId: Map<string, string>;
  },
  opts: Pick<CliOptions, 'includeActivity' | 'includeJobs' | 'includeChecks'>,
) {
  const { works, users, jobs, linkedJobs, checkRuns, activities, accesses } = bundle;
  const submissionIds = unique(works.flatMap((w) => w.submissions.map((s) => s.id)));

  await local.$transaction(async (tx) => {
    if (users.length > 0) {
      await tx.user.createMany({ data: users, skipDuplicates: true });
    }

    if (opts.includeJobs && jobs.length > 0) {
      await tx.job.createMany({ data: jobs, skipDuplicates: true });
    }

    if (works.length > 0) {
      await tx.work.createMany({
        data: works.map((w) =>
          stripRelations(w, ['versions', 'work_users', 'submissions', 'activity', 'access']),
        ),
        skipDuplicates: true,
      });
    }

    const workVersions = works.flatMap((w) => w.versions);
    if (workVersions.length > 0) {
      await tx.workVersion.createMany({ data: workVersions, skipDuplicates: true });
    }

    const workUsers = works.flatMap((w) => w.work_users);
    if (workUsers.length > 0) {
      await tx.workUser.createMany({ data: workUsers, skipDuplicates: true });
    }

    const submissions = works.flatMap((w) =>
      w.submissions.map((s) =>
        remapSubmissionRow(
          s,
          maps.targetSiteId,
          maps.kindIdByStagingId.get(s.kind_id)!,
          maps.collectionIdByStagingId.get(s.collection_id)!,
        ),
      ),
    );
    if (submissions.length > 0) {
      await tx.submission.createMany({ data: submissions, skipDuplicates: true });
    }

    const submissionVersions = works.flatMap((w) => w.submissions.flatMap((s) => s.versions));
    if (submissionVersions.length > 0) {
      await tx.submissionVersion.createMany({ data: submissionVersions, skipDuplicates: true });
    }

    const slugs = works.flatMap((w) => w.submissions.flatMap((s) => s.slugs));
    if (slugs.length > 0) {
      await tx.slug.createMany({
        data: slugs.map((slug) => ({ ...slug, site_id: maps.targetSiteId })),
        skipDuplicates: true,
      });
    }

    if (opts.includeChecks && checkRuns.length > 0) {
      await tx.checkServiceRun.createMany({ data: checkRuns, skipDuplicates: true });
    }

    if (opts.includeJobs && linkedJobs.length > 0) {
      await tx.linkedJob.createMany({ data: linkedJobs, skipDuplicates: true });
    }

    if (accesses.length > 0) {
      await tx.access.createMany({
        data: accesses.map((a) => remapAccessRow(a, maps.targetSiteId, maps.sourceSiteId)),
        skipDuplicates: true,
      });
    }

    if (opts.includeActivity && activities.length > 0) {
      const localRoleIds = new Set(
        (await tx.role.findMany({ select: { id: true } })).map((r) => r.id),
      );
      const activityRows = activities.map((a) => {
        const row = stripRelations(a, [
          'submission',
          'submission_version',
          'kind',
          'collection',
          'form',
          'work',
          'work_version',
          'site',
          'user',
          'access',
          'role',
          'user_role',
        ]);
        if (row.site_id === maps.sourceSiteId) {
          row.site_id = maps.targetSiteId;
        }
        if (row.role_id && !localRoleIds.has(row.role_id)) {
          row.role_id = null;
        }
        if (row.user_role_id) {
          row.user_role_id = null;
        }
        return row;
      });
      await tx.activity.createMany({ data: activityRows, skipDuplicates: true });
    }
  });

  return {
    works: workIds.length,
    workVersions: works.reduce((n, w) => n + w.versions.length, 0),
    workUsers: works.reduce((n, w) => n + w.work_users.length, 0),
    submissions: submissionIds.length,
    submissionVersions: works.reduce(
      (n, w) => n + w.submissions.reduce((m, s) => m + s.versions.length, 0),
      0,
    ),
    slugs: works.reduce((n, w) => n + w.submissions.reduce((m, s) => m + s.slugs.length, 0), 0),
    users: users.length,
    jobs: opts.includeJobs ? jobs.length : 0,
    activities: opts.includeActivity ? activities.length : 0,
    accesses: accesses.length,
    checkRuns: opts.includeChecks ? checkRuns.length : 0,
    linkedJobs: opts.includeJobs ? linkedJobs.length : 0,
  };
}

function assertSiteMappings(
  bundle: PullBundle,
  targetKinds: Map<string, string>,
  targetCollections: Map<string, string>,
  stagingKindNames: Map<string, string>,
  stagingCollectionNames: Map<string, string>,
): { kindIdByStagingId: Map<string, string>; collectionIdByStagingId: Map<string, string> } {
  const kindIdByStagingId = new Map<string, string>();
  const collectionIdByStagingId = new Map<string, string>();
  const missingKinds = new Set<string>();
  const missingCollections = new Set<string>();

  for (const stagingKindId of bundle.stagingKindNames.keys()) {
    const name = stagingKindNames.get(stagingKindId)!;
    const targetId = targetKinds.get(name);
    if (!targetId) missingKinds.add(name);
    else kindIdByStagingId.set(stagingKindId, targetId);
  }

  for (const stagingCollectionId of bundle.stagingCollectionNames.keys()) {
    const name = stagingCollectionNames.get(stagingCollectionId)!;
    const targetId = targetCollections.get(name);
    if (!targetId) missingCollections.add(name);
    else collectionIdByStagingId.set(stagingCollectionId, targetId);
  }

  if (missingKinds.size > 0 || missingCollections.size > 0) {
    const parts: string[] = [];
    if (missingKinds.size > 0) {
      parts.push(`submission kinds: ${[...missingKinds].join(', ')}`);
    }
    if (missingCollections.size > 0) {
      parts.push(`collections: ${[...missingCollections].join(', ')}`);
    }
    throw new Error(
      `Target site is missing entities required by staging data (${parts.join('; ')}). ` +
        'Seed or create matching kinds/collections on the local site first.',
    );
  }

  return { kindIdByStagingId, collectionIdByStagingId };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const staging = createPrismaClient(opts.stagingUrl, {
    sslRejectUnauthorized: opts.stagingSslInsecure ? false : undefined,
    poolMax: 2,
  });
  const local = createPrismaClient(opts.localUrl, { poolMax: 4 });

  try {
    await staging.$connect();
    await local.$connect();

    const sourceSite = await resolveSite(staging, opts.sourceSite, 'Source');
    const targetSite = await resolveSite(local, opts.targetSite, 'Target');

    console.log(`Source: ${sourceSite.name} (${sourceSite.id})`);
    console.log(`Target: ${targetSite.name} (${targetSite.id})`);
    console.log(`Limit: ${opts.limit} works`);

    const workIds = await selectWorkIds(staging, sourceSite.id, opts.limit);
    console.log(`Selected ${workIds.length} work(s) from staging submissions`);

    if (workIds.length === 0) {
      console.log('Nothing to import.');
      return;
    }

    const bundle = await fetchBundle(staging, sourceSite.id, workIds, opts);
    const targetKindByName = buildNameMap(targetSite.submissionKinds);
    const targetCollectionByName = buildNameMap(targetSite.collections);
    const { kindIdByStagingId, collectionIdByStagingId } = assertSiteMappings(
      bundle,
      targetKindByName,
      targetCollectionByName,
      bundle.stagingKindNames,
      bundle.stagingCollectionNames,
    );

    const submissionIds = unique(bundle.works.flatMap((w) => w.submissions.map((s) => s.id)));

    console.log('Planned import:');
    console.log(`  users:              ${bundle.users.length}`);
    console.log(`  works:              ${bundle.works.length}`);
    console.log(
      `  work versions:      ${bundle.works.reduce((n, w) => n + w.versions.length, 0)}`,
    );
    console.log(
      `  work users:         ${bundle.works.reduce((n, w) => n + w.work_users.length, 0)}`,
    );
    console.log(`  submissions:        ${submissionIds.length}`);
    console.log(
      `  submission versions:${bundle.works.reduce((n, w) => n + w.submissions.reduce((m, s) => m + s.versions.length, 0), 0)}`,
    );
    if (opts.includeJobs) {
      console.log(`  jobs:               ${bundle.jobs.length}`);
      console.log(`  linked jobs:        ${bundle.linkedJobs.length}`);
    }
    if (opts.includeChecks) {
      console.log(`  check service runs: ${bundle.checkRuns.length}`);
    }
    if (opts.includeActivity) {
      console.log(`  activities:         ${bundle.activities.length}`);
    }
    console.log(`  access rows:        ${bundle.accesses.length}`);

    if (opts.dryRun) {
      console.log('\nDry run — no writes performed.');
      return;
    }

    if (opts.replace) {
      console.log('\nReplacing existing local rows for these works…');
      await purgeLocalCopies(local, targetSite.id, workIds, submissionIds);
    }

    const counts = await importBundle(
      local,
      bundle,
      {
        targetSiteId: targetSite.id,
        sourceSiteId: sourceSite.id,
        kindIdByStagingId,
        collectionIdByStagingId,
      },
      opts,
    );

    console.log('\nImport complete:');
    for (const [key, value] of Object.entries(counts)) {
      console.log(`  ${key}: ${value}`);
    }
    console.log(
      '\nNote: CDN keys point at staging storage. Local converters/checks may need matching bucket access.',
    );
  } finally {
    await disconnectPrisma(staging, 'staging');
    await disconnectPrisma(local, 'local');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
