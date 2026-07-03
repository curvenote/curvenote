import { Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from '../../prisma.server.js';
import { getConfig } from '../../../app-config.server.js';
import { collectAllowedCronTickHosts } from '../../cron/resolveCronTickUrl.server.js';
import { resolveStoredQueueDrainUrl } from './notifyQueueConsumer.server.js';
import { getJobQueueDepth, peekJobQueue } from './pgmq/jobQueue.server.js';
import type { QueuePeekEntry } from './pgmq/types.js';

const DRAIN_URL_PATH = '/v1/jobs/push-to-drain';

/**
 * Admin helpers for the pgmq job queue: read/update the `_JobQueueDrainConfig`
 * row that the pg_net enqueue trigger and pg_cron backup use to wake the
 * consumer, and a read-only peek at the queue tail for monitoring.
 *
 * The drain secret is never returned to callers — only whether it is set, its
 * length, and whether it matches the app-config `api.queueConsumerSecret`.
 */

export type JobQueueDrainStatus = {
  /** True when a `_JobQueueDrainConfig` row exists with a non-empty url + secret. */
  configured: boolean;
  /** The currently stored drain url, if any. */
  drainUrl: string | null;
  /** Default url derived from app-config (`api.tasksCallbackUrl` if set, else `api.url`). */
  defaultDrainUrl: string;
  /** Whether a secret is stored (non-empty). */
  hasSecret: boolean;
  /** Length of the stored secret (for a sanity check; not the value). */
  secretLength: number;
  /** Length of the app-config `api.queueConsumerSecret`. */
  appConfigSecretLength: number;
  /** True when the stored secret equals the app-config secret. */
  secretMatchesAppConfig: boolean;
};

type DrainConfigRow = {
  drain_url: string;
  drain_secret: string;
};

async function readDrainConfigRow(): Promise<DrainConfigRow | null> {
  const prisma = await getPrismaClient();
  const rows = await prisma.$queryRaw<DrainConfigRow[]>(
    Prisma.sql`SELECT drain_url, drain_secret FROM "_JobQueueDrainConfig" WHERE id = 1`,
  );
  return rows[0] ?? null;
}

export async function resolveDefaultQueueDrainUrl(): Promise<string> {
  const config = await getConfig();
  return resolveStoredQueueDrainUrl(config.api);
}

export async function getJobQueueDrainStatus(): Promise<JobQueueDrainStatus> {
  const config = await getConfig();
  const appSecret = config.api.queueConsumerSecret ?? '';
  const defaultDrainUrl = resolveStoredQueueDrainUrl(config.api);

  const row = await readDrainConfigRow();
  const drainUrl = row?.drain_url ?? null;
  const storedSecret = row?.drain_secret ?? '';

  return {
    configured: Boolean(drainUrl && storedSecret),
    drainUrl,
    defaultDrainUrl,
    hasSecret: storedSecret.length > 0,
    secretLength: storedSecret.length,
    appConfigSecretLength: appSecret.length,
    secretMatchesAppConfig: storedSecret.length > 0 && storedSecret === appSecret,
  };
}

function normalizeDrainPathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  return trimmed === '' ? '/' : trimmed;
}

/**
 * Validate a drain url before storing in `_JobQueueDrainConfig`. Restricts
 * host to app-config API bases and path to `/v1/jobs/push-to-drain` — the
 * SECURITY DEFINER `job_queue_cron_drain()` function sends a live bearer
 * secret to this url on every pg_cron tick, so an unrestricted host would
 * let anyone able to set it exfiltrate that secret to an arbitrary host.
 */
export function assertValidDrainUrl(
  url: string,
  api: Parameters<typeof collectAllowedCronTickHosts>[0],
): string {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Drain url must be a valid absolute URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Drain url must use http or https');
  }
  if (normalizeDrainPathname(parsed.pathname) !== DRAIN_URL_PATH) {
    throw new Error(`Drain url path must be ${DRAIN_URL_PATH}`);
  }
  const allowedHosts = collectAllowedCronTickHosts(api);
  if (!allowedHosts.has(parsed.host)) {
    throw new Error(
      `Drain url host must match app-config API host (${[...allowedHosts].join(', ')})`,
    );
  }
  return trimmed;
}

/**
 * Set the drain url on the `_JobQueueDrainConfig` row. When no row exists yet,
 * the secret is seeded from the app-config so the NOT NULL secret column is
 * satisfied (equivalent to also pushing the secret).
 */
export async function setJobQueueDrainUrl(url: string): Promise<void> {
  const config = await getConfig();
  const validUrl = assertValidDrainUrl(url, config.api);
  const appSecret = config.api.queueConsumerSecret ?? '';

  const prisma = await getPrismaClient();
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "_JobQueueDrainConfig" (id, drain_url, drain_secret)
      VALUES (1, ${validUrl}, ${appSecret})
      ON CONFLICT (id) DO UPDATE SET drain_url = EXCLUDED.drain_url
    `,
  );
}

/**
 * Push the app-config `api.queueConsumerSecret` to the `_JobQueueDrainConfig`
 * row. When no row exists yet, the url is seeded from the app-config default.
 */
export async function pushJobQueueDrainSecretFromConfig(): Promise<void> {
  const config = await getConfig();
  const appSecret = config.api.queueConsumerSecret ?? '';
  if (!appSecret) {
    throw new Error('app-config api.queueConsumerSecret is empty — nothing to push');
  }
  const defaultUrl = resolveStoredQueueDrainUrl(config.api);

  const prisma = await getPrismaClient();
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "_JobQueueDrainConfig" (id, drain_url, drain_secret)
      VALUES (1, ${defaultUrl}, ${appSecret})
      ON CONFLICT (id) DO UPDATE SET drain_secret = EXCLUDED.drain_secret
    `,
  );
}

export type JobQueueTail = {
  /** Current queue depth, or null when unavailable. */
  depth: number | null;
  entries: QueuePeekEntry[];
  /** Soft error message when the tail could not be read (e.g. pgmq not installed). */
  error: string | null;
};

export async function getJobQueueTail(limit = 25): Promise<JobQueueTail> {
  try {
    const [entries, depth] = await Promise.all([peekJobQueue(limit), getJobQueueDepth()]);
    return { depth, entries, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read queue tail';
    return { depth: null, entries: [], error: message };
  }
}
