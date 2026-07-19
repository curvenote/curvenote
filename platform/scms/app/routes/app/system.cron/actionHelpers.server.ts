import {
  withValidFormData,
  dbCreateCronJob,
  CronJobTargetType,
  CronJobTargetAuth,
  computeInitialNextRunAt,
  getConfig,
  resolveApiPath,
  type SecureContext,
} from '@curvenote/scms-server';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { uuidv7 } from 'uuidv7';
import { CRON_HTTP_METHODS } from './constants.js';

const RELATIVE_TARGET_PATH = /^\/[^\s]+$/;

export const CreateCronJobSchema = zfd.formData({
  intent: z.literal('create'),
  name: zfd.text(z.string().trim().min(1, 'Name is required')),
  description: zfd.text(z.string().trim().optional()),
  schedule: zfd.text(z.string().trim().min(1, 'Schedule is required')),
  http_method: zfd.text(
    z.enum(CRON_HTTP_METHODS, 'HTTP method must be GET, POST, PUT, PATCH, or DELETE'),
  ),
  target_path: zfd.text(
    z
      .string()
      .trim()
      .min(1, 'Target path is required')
      .regex(RELATIVE_TARGET_PATH, 'Target path must start with / (e.g. /v1/jobs/push-to-drain)'),
  ),
  target_scope: zfd.text(z.string().trim().min(1, 'Scope is required')),
});

function assertValidCronSchedule(schedule: string): void {
  try {
    computeInitialNextRunAt(schedule, 'UTC');
  } catch {
    throw new Error('Invalid cron schedule expression');
  }
}

export async function handleCreateCronJob(ctx: SecureContext, formData: FormData) {
  return withValidFormData(CreateCronJobSchema, formData, async (payload) => {
    assertValidCronSchedule(payload.schedule);

    const config = await getConfig();
    const httpMethod = payload.http_method || 'POST';
    const targetPath = payload.target_path.trim();
    const targetUrl = resolveApiPath(config.api.url, targetPath);
    const targetScope = payload.target_scope.trim();

    await dbCreateCronJob(uuidv7(), {
      name: payload.name,
      description: payload.description || null,
      schedule: payload.schedule,
      target_type: CronJobTargetType.HTTP,
      target_url: targetUrl,
      http_method: httpMethod,
      target_auth: CronJobTargetAuth.HANDSHAKE,
      target_scope: targetScope,
      created_by: ctx.user?.id,
    });

    return { success: true as const, message: 'Cron job created successfully' };
  });
}
