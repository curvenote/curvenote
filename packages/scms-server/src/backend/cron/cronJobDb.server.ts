import {
  CronJobLastStatus,
  CronJobTargetAuth,
  CronJobTargetType,
  Prisma,
  type CronJob,
} from '@curvenote/scms-db';
import { getConfig } from '../../app-config.server.js';
import { getPrismaClient } from '../prisma.server.js';
import { assertAllowedCronTargetUrl } from './assertAllowedCronTargetUrl.server.js';
import { computeInitialNextRunAt, computeNextRunAt } from './computeNextRunAt.server.js';

export type CronJobInput = {
  name: string;
  description?: string | null;
  schedule: string;
  timezone?: string;
  enabled?: boolean;
  target_type: CronJobTargetType;
  target_url?: string | null;
  http_method?: string | null;
  target_auth?: CronJobTargetAuth;
  target_scope?: string | null;
  headers?: Prisma.InputJsonValue | null;
  payload?: Prisma.InputJsonValue | null;
  job_type?: string | null;
  job_payload?: Prisma.InputJsonValue | null;
  created_by?: string | null;
  /** Explicit initial next_run_at (e.g. seeding a builtin job); computed from schedule when omitted. */
  next_run_at?: string;
};

async function validateCronJobTargetUrl(
  targetType: CronJobTargetType,
  targetUrl: string | null | undefined,
): Promise<void> {
  if (targetType !== CronJobTargetType.HTTP || !targetUrl) {
    return;
  }
  const config = await getConfig();
  assertAllowedCronTargetUrl(targetUrl, config.api);
}

export async function dbListCronJobs(): Promise<CronJob[]> {
  const prisma = await getPrismaClient();
  return prisma.cronJob.findMany({ orderBy: [{ enabled: 'desc' }, { name: 'asc' }] });
}

export async function dbGetCronJob(id: string): Promise<CronJob | null> {
  const prisma = await getPrismaClient();
  return prisma.cronJob.findUnique({ where: { id } });
}

export async function dbCreateCronJob(id: string, data: CronJobInput): Promise<CronJob> {
  await validateCronJobTargetUrl(data.target_type, data.target_url);

  const prisma = await getPrismaClient();
  const nowIso = new Date().toISOString();
  const timezone = data.timezone ?? 'UTC';
  const nextRunAt = data.next_run_at ?? computeInitialNextRunAt(data.schedule, timezone);

  return prisma.cronJob.create({
    data: {
      id,
      name: data.name,
      description: data.description ?? null,
      schedule: data.schedule,
      timezone,
      enabled: data.enabled ?? true,
      target_type: data.target_type,
      target_url: data.target_url ?? null,
      http_method: data.http_method ?? 'POST',
      target_auth: data.target_auth ?? CronJobTargetAuth.HANDSHAKE,
      target_scope: data.target_scope ?? null,
      headers: data.headers ?? undefined,
      payload: data.payload ?? undefined,
      job_type: data.job_type ?? null,
      job_payload: data.job_payload ?? undefined,
      next_run_at: nextRunAt,
      created_by: data.created_by ?? null,
      date_created: nowIso,
      date_modified: nowIso,
    },
  });
}

export async function dbUpdateCronJob(id: string, data: Partial<CronJobInput>): Promise<CronJob> {
  const prisma = await getPrismaClient();
  const existing = await prisma.cronJob.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Cron job not found');
  }
  const targetType = data.target_type ?? existing.target_type;
  const targetUrl = data.target_url === undefined ? existing.target_url : data.target_url;
  await validateCronJobTargetUrl(targetType, targetUrl);

  const nowIso = new Date().toISOString();
  const schedule = data.schedule ?? existing.schedule;
  const timezone = data.timezone ?? existing.timezone;
  const scheduleChanged = data.schedule != null || data.timezone != null;

  return prisma.cronJob.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description === undefined ? undefined : data.description,
      schedule: data.schedule,
      timezone: data.timezone,
      enabled: data.enabled,
      target_type: data.target_type,
      target_url: data.target_url === undefined ? undefined : data.target_url,
      http_method: data.http_method === undefined ? undefined : data.http_method,
      target_auth: data.target_auth,
      target_scope: data.target_scope === undefined ? undefined : data.target_scope,
      headers: data.headers === undefined ? undefined : (data.headers ?? Prisma.JsonNull),
      payload: data.payload === undefined ? undefined : (data.payload ?? Prisma.JsonNull),
      job_type: data.job_type === undefined ? undefined : data.job_type,
      job_payload:
        data.job_payload === undefined ? undefined : (data.job_payload ?? Prisma.JsonNull),
      next_run_at: scheduleChanged ? computeNextRunAt(schedule, timezone) : undefined,
      date_modified: nowIso,
    },
  });
}

export async function dbDeleteCronJob(id: string): Promise<void> {
  const prisma = await getPrismaClient();
  await prisma.cronJob.delete({ where: { id } });
}

export async function dbSetCronJobEnabled(id: string, enabled: boolean): Promise<CronJob> {
  return dbUpdateCronJob(id, { enabled });
}

/** Idempotent seed for a builtin CronJob: no-op if a row with this id already exists. */
export async function dbSeedBuiltinCronJob(id: string, data: CronJobInput): Promise<void> {
  const prisma = await getPrismaClient();
  const existing = await prisma.cronJob.findUnique({ where: { id } });
  if (existing) return;

  await dbCreateCronJob(id, data);
}

export { CronJobLastStatus, CronJobTargetAuth, CronJobTargetType };
