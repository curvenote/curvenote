import {
  CronJobLastStatus,
  CronJobTargetAuth,
  CronJobTargetType,
  Prisma,
} from '@curvenote/scms-db';
import { getConfig } from '../../app-config.server.js';
import { assertAllowedCronTargetUrl } from './assertAllowedCronTargetUrl.server.js';
import { resolveScopedCronTargetUrl } from './resolveScopedCronTargetUrl.server.js';
import { getPrismaClient } from '../prisma.server.js';
import { enqueueAndDispatchJob } from '../jobs/enqueue/enqueueAndDispatchJob.server.js';
import { createScopedHandshakeToken } from '../sign.handshake.server.js';
import { computeNextRunAt, resolveRecordedNextRunAt } from './computeNextRunAt.server.js';
import type { DueCronJobRow } from './computeNextRunAt.server.js';

const CRON_TICK_ADVISORY_LOCK_KEY = 734827601;
const DEFAULT_CLAIM_LIMIT = 50;
const SCOPED_HANDSHAKE_EXPIRY_SECONDS = 60 * 15;
/** A running_since older than this is treated as a stale lease from a crashed run, not a live one. */
const STALE_RUNNING_LEASE_MS = 30 * 60 * 1000;

export type RunDueCronJobsResult = {
  claimed: number;
  succeeded: number;
  failed: number;
};

function staleRunningCutoffIso(nowIso: string): string {
  return new Date(new Date(nowIso).getTime() - STALE_RUNNING_LEASE_MS).toISOString();
}

type ClaimableCronJob = { job: DueCronJobRow; nextRunAt: string };
type InvalidScheduleCronJob = { job: DueCronJobRow; error: string };

function partitionDueCronJobsBySchedule(
  due: DueCronJobRow[],
  claimTime: Date,
): { claimable: ClaimableCronJob[]; invalid: InvalidScheduleCronJob[] } {
  const claimable: ClaimableCronJob[] = [];
  const invalid: InvalidScheduleCronJob[] = [];
  for (const job of due) {
    try {
      claimable.push({
        job,
        nextRunAt: computeNextRunAt(job.schedule, job.timezone, claimTime),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid cron schedule';
      invalid.push({ job, error: message });
    }
  }
  return { claimable, invalid };
}

async function disableInvalidScheduleCronJobs(
  tx: Pick<Awaited<ReturnType<typeof getPrismaClient>>, 'cronJob'>,
  invalid: InvalidScheduleCronJob[],
  nowIso: string,
): Promise<void> {
  for (const { job, error } of invalid) {
    console.error('[runDueCronJobs] disabling cron with invalid schedule', {
      id: job.id,
      name: job.name,
      schedule: job.schedule,
      error,
    });
    await tx.cronJob.update({
      where: { id: job.id },
      data: {
        enabled: false,
        next_run_at: null,
        running_since: null,
        last_status: CronJobLastStatus.FAILED,
        last_error: `Invalid schedule: ${error}`,
        date_modified: nowIso,
      },
    });
  }
}

async function claimDueCronJobs(nowIso: string, limit: number): Promise<DueCronJobRow[]> {
  const prisma = await getPrismaClient();
  const claimTime = new Date(nowIso);
  const staleCutoff = staleRunningCutoffIso(nowIso);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${CRON_TICK_ADVISORY_LOCK_KEY})`);
    const due = await tx.$queryRaw<DueCronJobRow[]>(
      Prisma.sql`
        SELECT * FROM "CronJob"
        WHERE enabled = true
          AND next_run_at IS NOT NULL
          AND next_run_at <= ${nowIso}
          AND (running_since IS NULL OR running_since < ${staleCutoff})
        ORDER BY next_run_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `,
    );

    if (due.length === 0) {
      return [];
    }

    const { claimable, invalid } = partitionDueCronJobsBySchedule(due, claimTime);
    await disableInvalidScheduleCronJobs(tx, invalid, nowIso);

    if (claimable.length === 0) {
      return [];
    }

    // Each row's next_run_at is computed from its own schedule/timezone, so this
    // is a single bulk UPDATE keyed by a VALUES list rather than N per-row UPDATEs.
    const values = Prisma.join(
      claimable.map(({ job, nextRunAt }) => Prisma.sql`(${job.id}::text, ${nextRunAt}::text)`),
    );
    return tx.$queryRaw<DueCronJobRow[]>(
      Prisma.sql`
        UPDATE "CronJob" AS c
        SET next_run_at = v.next_run_at, running_since = ${nowIso}, date_modified = ${nowIso}
        FROM (VALUES ${values}) AS v(id, next_run_at)
        WHERE c.id = v.id
        RETURNING c.*
      `,
    );
  });
}

async function resolveHttpTargetUrl(job: DueCronJobRow): Promise<string> {
  const config = await getConfig();
  if (job.target_url) {
    return assertAllowedCronTargetUrl(job.target_url, config.api);
  }
  if (job.target_scope) {
    return resolveScopedCronTargetUrl(job.target_scope, config.api);
  }
  throw new Error('HTTP cron missing target_url');
}

async function executeHttpTarget(job: DueCronJobRow): Promise<void> {
  const targetUrl = await resolveHttpTargetUrl(job);
  const config = await getConfig();
  const method = (job.http_method ?? 'POST').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(job.headers as Record<string, string> | null),
  };

  if (job.target_auth === CronJobTargetAuth.HANDSHAKE) {
    if (!job.target_scope) {
      throw new Error('HANDSHAKE cron missing target_scope');
    }
    const token = createScopedHandshakeToken(
      job.target_scope,
      config.api.handshakeIssuer,
      config.api.handshakeSigningSecret,
      Math.floor(Date.now() / 1000) + SCOPED_HANDSHAKE_EXPIRY_SECONDS,
    );
    headers.Authorization = `Bearer ${token}`;
  } else if (job.target_auth === CronJobTargetAuth.NONE) {
    delete headers.Authorization;
  }

  const body =
    job.payload != null && method !== 'GET' && method !== 'HEAD'
      ? JSON.stringify(job.payload)
      : undefined;

  const response = await fetch(targetUrl, { method, headers, body });
  if (response.status < 200 || response.status >= 300) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }
}

async function executeJobTarget(job: DueCronJobRow): Promise<void> {
  if (!job.job_type) {
    throw new Error('JOB cron missing job_type');
  }
  const config = await getConfig();
  const jobId = crypto.randomUUID();
  await enqueueAndDispatchJob({
    job_id: jobId,
    job_type: job.job_type,
    payload: (job.job_payload as Record<string, unknown>) ?? {},
    invoked_by_id: config.api.submissionsServiceAccount.id,
  });
}

async function executeCronJob(job: DueCronJobRow): Promise<void> {
  if (job.target_type === CronJobTargetType.HTTP) {
    await executeHttpTarget(job);
    return;
  }
  if (job.target_type === CronJobTargetType.JOB) {
    await executeJobTarget(job);
    return;
  }
  throw new Error(`Unknown target_type: ${job.target_type}`);
}

async function recordCronRun(
  job: DueCronJobRow,
  result: { ok: boolean; error?: string; durationMs: number },
): Promise<void> {
  const prisma = await getPrismaClient();
  const nowIso = new Date().toISOString();
  const nextRunAt = resolveRecordedNextRunAt(
    job.schedule,
    job.timezone,
    new Date(nowIso),
    job.next_run_at,
  );

  await prisma.cronJob.update({
    where: { id: job.id },
    data: {
      last_run_at: nowIso,
      next_run_at: nextRunAt,
      last_status: result.ok ? CronJobLastStatus.SUCCESS : CronJobLastStatus.FAILED,
      last_error: result.ok ? null : (result.error ?? 'Unknown error'),
      last_run_ms: result.durationMs,
      running_since: null,
      date_modified: nowIso,
    },
  });
}

async function executeAndRecordCronJob(job: DueCronJobRow): Promise<boolean> {
  const started = Date.now();
  try {
    await executeCronJob(job);
    await recordCronRun(job, { ok: true, durationMs: Date.now() - started });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cron execution failed';
    console.error('[runDueCronJobs] job failed', { name: job.name, error: message });
    await recordCronRun(job, { ok: false, error: message, durationMs: Date.now() - started });
    return false;
  }
}

export async function runDueCronJobs(limit = DEFAULT_CLAIM_LIMIT): Promise<RunDueCronJobsResult> {
  const nowIso = new Date().toISOString();
  const due = await claimDueCronJobs(nowIso, limit);

  // Claimed jobs are independent — no shared lock is held past the claim
  // transaction — so run them concurrently rather than one at a time.
  // allSettled (not all): executeAndRecordCronJob already catches its own
  // errors, but a fulfilled/rejected split still protects the aggregation
  // below if recordCronRun itself ever throws unexpectedly.
  const results = await Promise.allSettled(due.map((job) => executeAndRecordCronJob(job)));
  const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  const failed = due.length - succeeded;

  return { claimed: due.length, succeeded, failed };
}

/**
 * Run a single cron immediately (admin Run-now), regardless of next_run_at.
 * Claims the same `running_since` lease the tick uses, so a manual run can't
 * overlap a concurrent tick execution or another manual run of the same job.
 */
export async function runCronJobNow(jobId: string): Promise<void> {
  const prisma = await getPrismaClient();
  const nowIso = new Date().toISOString();
  const staleCutoff = staleRunningCutoffIso(nowIso);

  const claimed = await prisma.$queryRaw<DueCronJobRow[]>(
    Prisma.sql`
      UPDATE "CronJob"
      SET running_since = ${nowIso}, date_modified = ${nowIso}
      WHERE id = ${jobId}
        AND (running_since IS NULL OR running_since < ${staleCutoff})
      RETURNING *
    `,
  );

  const job = claimed[0];
  if (!job) {
    const existing = await prisma.cronJob.findUnique({ where: { id: jobId } });
    if (!existing) {
      throw new Error('Cron job not found');
    }
    throw new Error('Cron job is already running');
  }

  const started = Date.now();
  try {
    await executeCronJob(job);
    await recordCronRun(job, { ok: true, durationMs: Date.now() - started });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cron execution failed';
    await recordCronRun(job, { ok: false, error: message, durationMs: Date.now() - started });
    throw err;
  }
}
