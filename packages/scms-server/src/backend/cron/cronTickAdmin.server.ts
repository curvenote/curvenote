import { Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from '../prisma.server.js';
import { getConfig } from '../../app-config.server.js';
import { resolveStoredCronTickUrl } from './resolveCronTickUrl.server.js';

export type CronTickStatus = {
  configured: boolean;
  tickUrl: string | null;
  defaultTickUrl: string;
  hasSecret: boolean;
  secretLength: number;
  appConfigSecretLength: number;
  secretMatchesAppConfig: boolean;
};

export type PgCronHealth = {
  available: boolean;
  cronTickScheduled: boolean;
  cronTickActive: boolean | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  drainBackupScheduled: boolean;
};

type TickConfigRow = {
  tick_url: string;
  tick_secret: string;
};

async function readTickConfigRow(): Promise<TickConfigRow | null> {
  const prisma = await getPrismaClient();
  const rows = await prisma.$queryRaw<TickConfigRow[]>(
    Prisma.sql`SELECT tick_url, tick_secret FROM "_CronTickConfig" WHERE id = 1`,
  );
  return rows[0] ?? null;
}

export async function resolveDefaultCronTickUrl(): Promise<string> {
  const config = await getConfig();
  return resolveStoredCronTickUrl(config.api);
}

export async function getCronTickStatus(): Promise<CronTickStatus> {
  const config = await getConfig();
  const appSecret = config.api.cron?.secret ?? '';
  const defaultTickUrl = resolveStoredCronTickUrl(config.api);
  const row = await readTickConfigRow();
  const tickUrl = row?.tick_url ?? null;
  const storedSecret = row?.tick_secret ?? '';

  return {
    configured: Boolean(tickUrl && storedSecret),
    tickUrl,
    defaultTickUrl,
    hasSecret: storedSecret.length > 0,
    secretLength: storedSecret.length,
    appConfigSecretLength: appSecret.length,
    secretMatchesAppConfig: storedSecret.length > 0 && storedSecret === appSecret,
  };
}

function assertValidTickUrl(url: string): string {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Tick url must be a valid absolute URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Tick url must use http or https');
  }
  return trimmed;
}

export async function setCronTickUrl(url: string): Promise<void> {
  const validUrl = assertValidTickUrl(url);
  const config = await getConfig();
  const appSecret = config.api.cron?.secret ?? '';
  const prisma = await getPrismaClient();
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "_CronTickConfig" (id, tick_url, tick_secret)
      VALUES (1, ${validUrl}, ${appSecret})
      ON CONFLICT (id) DO UPDATE SET tick_url = EXCLUDED.tick_url
    `,
  );
}

export async function pushCronTickSecretFromConfig(): Promise<void> {
  const config = await getConfig();
  const appSecret = config.api.cron?.secret ?? '';
  if (!appSecret) {
    throw new Error('app-config api.cron.secret is empty — nothing to push');
  }
  const defaultUrl = resolveStoredCronTickUrl(config.api);

  const prisma = await getPrismaClient();
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "_CronTickConfig" (id, tick_url, tick_secret)
      VALUES (1, ${defaultUrl}, ${appSecret})
      ON CONFLICT (id) DO UPDATE SET tick_secret = EXCLUDED.tick_secret
    `,
  );
}

export async function getPgCronHealth(): Promise<PgCronHealth> {
  const prisma = await getPrismaClient();
  try {
    const extRows = await prisma.$queryRaw<{ exists: boolean }[]>(
      Prisma.sql`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS exists`,
    );
    const available = extRows[0]?.exists ?? false;
    if (!available) {
      return {
        available: false,
        cronTickScheduled: false,
        cronTickActive: null,
        lastRunAt: null,
        lastRunStatus: null,
        drainBackupScheduled: false,
      };
    }

    type JobRow = { active: boolean; jobname: string };
    const jobs = await prisma.$queryRaw<JobRow[]>(
      Prisma.sql`SELECT jobname, active FROM cron.job WHERE jobname IN ('cron-tick', 'job-queue-drain-backup')`,
    );
    const cronTick = jobs.find((j) => j.jobname === 'cron-tick');
    const drainBackup = jobs.find((j) => j.jobname === 'job-queue-drain-backup');

    type RunRow = { status: string; start_time: Date };
    const runs = cronTick
      ? await prisma.$queryRaw<RunRow[]>(
          Prisma.sql`
            SELECT status, start_time
            FROM cron.job_run_details
            WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cron-tick' LIMIT 1)
            ORDER BY start_time DESC
            LIMIT 1
          `,
        )
      : [];

    const last = runs[0];
    return {
      available: true,
      cronTickScheduled: Boolean(cronTick),
      cronTickActive: cronTick?.active ?? null,
      lastRunAt: last?.start_time ? new Date(last.start_time).toISOString() : null,
      lastRunStatus: last?.status ?? null,
      drainBackupScheduled: Boolean(drainBackup),
    };
  } catch {
    return {
      available: false,
      cronTickScheduled: false,
      cronTickActive: null,
      lastRunAt: null,
      lastRunStatus: null,
      drainBackupScheduled: false,
    };
  }
}

/** Guarded admin cutover: unschedule pg_cron job-queue-drain-backup when tick is configured. */
export async function unscheduleJobQueueDrainBackup(): Promise<void> {
  const status = await getCronTickStatus();
  if (!status.configured || !status.secretMatchesAppConfig) {
    throw new Error('Tick config must be populated and match app-config before cutover');
  }
  const prisma = await getPrismaClient();
  await prisma.$executeRaw(
    Prisma.sql`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'job-queue-drain-backup') THEN
          PERFORM cron.unschedule('job-queue-drain-backup');
        END IF;
      END;
      $$;
    `,
  );
}

export async function rescheduleJobQueueDrainBackup(): Promise<void> {
  const prisma = await getPrismaClient();
  await prisma.$executeRaw(
    Prisma.sql`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
          IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'job-queue-drain-backup') THEN
            PERFORM cron.schedule(
              'job-queue-drain-backup',
              '30 seconds',
              $cron$SELECT public.job_queue_cron_drain()$cron$
            );
          END IF;
        END IF;
      END;
      $$;
    `,
  );
}
