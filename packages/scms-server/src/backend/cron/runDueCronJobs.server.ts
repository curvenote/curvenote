import {
  CronJobLastStatus,
  CronJobTargetAuth,
  CronJobTargetType,
  Prisma,
} from '@curvenote/scms-db';
import { getConfig } from '../../app-config.server.js';
import { resolveStoredQueueDrainUrl } from '../jobs/enqueue/notifyQueueConsumer.server.js';
import { CronEndpointScopes } from './scopes.js';
import { assertAllowedCronTargetUrl } from './assertAllowedCronTargetUrl.server.js';
import { getPrismaClient } from '../prisma.server.js';
import { enqueueAndDispatchJob } from '../jobs/enqueue/enqueueAndDispatchJob.server.js';
import { createScopedHandshakeToken } from '../sign.handshake.server.js';
import { computeNextRunAt, resolveRecordedNextRunAt } from './computeNextRunAt.server.js';
import type { DueCronJobRow } from './computeNextRunAt.server.js';

const CRON_TICK_ADVISORY_LOCK_KEY = 734827601;
const DEFAULT_CLAIM_LIMIT = 50;
const SCOPED_HANDSHAKE_EXPIRY_SECONDS = 60 * 15;

export type RunDueCronJobsResult = {
  claimed: number;
  succeeded: number;
  failed: number;
};

async function claimDueCronJobs(nowIso: string, limit: number): Promise<DueCronJobRow[]> {
  const prisma = await getPrismaClient();
  const claimTime = new Date(nowIso);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${CRON_TICK_ADVISORY_LOCK_KEY})`);
    const due = await tx.$queryRaw<DueCronJobRow[]>(
      Prisma.sql`
        SELECT * FROM "CronJob"
        WHERE enabled = true
          AND next_run_at IS NOT NULL
          AND next_run_at <= ${nowIso}
        ORDER BY next_run_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `,
    );

    const claimed: DueCronJobRow[] = [];
    for (const job of due) {
      const nextRunAt = computeNextRunAt(job.schedule, job.timezone, claimTime);
      const updated = await tx.cronJob.update({
        where: { id: job.id },
        data: {
          next_run_at: nextRunAt,
          date_modified: nowIso,
        },
      });
      claimed.push(updated);
    }
    return claimed;
  });
}

async function resolveHttpTargetUrl(job: DueCronJobRow): Promise<string> {
  const config = await getConfig();
  if (job.target_url) {
    return assertAllowedCronTargetUrl(job.target_url, config.api);
  }
  const drainBase = resolveStoredQueueDrainUrl(config.api);
  if (job.target_scope === CronEndpointScopes.JOB_QUEUE_DRAIN) {
    return drainBase;
  }
  if (job.target_scope === CronEndpointScopes.PROMOTE_SCHEDULED) {
    return drainBase.replace(/\/push-to-drain\/?$/, '/promote-scheduled');
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
      date_modified: nowIso,
    },
  });
}

export async function runDueCronJobs(limit = DEFAULT_CLAIM_LIMIT): Promise<RunDueCronJobsResult> {
  const nowIso = new Date().toISOString();
  const due = await claimDueCronJobs(nowIso, limit);
  let succeeded = 0;
  let failed = 0;

  for (const job of due) {
    const started = Date.now();
    try {
      await executeCronJob(job);
      await recordCronRun(job, { ok: true, durationMs: Date.now() - started });
      succeeded += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cron execution failed';
      console.error('[runDueCronJobs] job failed', { name: job.name, error: message });
      await recordCronRun(job, { ok: false, error: message, durationMs: Date.now() - started });
      failed += 1;
    }
  }

  return { claimed: due.length, succeeded, failed };
}

/** Run a single cron immediately (admin Run-now), regardless of next_run_at. */
export async function runCronJobNow(jobId: string): Promise<void> {
  const prisma = await getPrismaClient();
  const job = await prisma.cronJob.findUnique({ where: { id: jobId } });
  if (!job) {
    throw new Error('Cron job not found');
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
