import {
  withValidFormData,
  dbCreateCronJob,
  CronJobTargetType,
  CronJobTargetAuth,
  cronEndpointScope,
  computeInitialNextRunAt,
  type SecureContext,
} from '@curvenote/scms-server';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { uuidv7 } from 'uuidv7';

const CRON_NAME_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CreateCronJobSchema = zfd.formData({
  intent: z.literal('create'),
  name: zfd.text(
    z
      .string()
      .trim()
      .min(1, 'Identifier is required')
      .regex(
        CRON_NAME_REGEX,
        'Identifier must use lowercase letters, numbers, and hyphens only (e.g. my-new-cron)',
      ),
  ),
  description: zfd.text(z.string().trim().min(1, 'Display name is required')),
  schedule: zfd.text(z.string().trim().min(1, 'Schedule is required')),
  http_method: zfd.text(z.string().trim().min(1).default('POST')),
  target_url: zfd.text(z.string().trim().url('Target URL must be a valid absolute URL')),
  target_scope: zfd.text(z.string().trim().optional()),
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

    const httpMethod = payload.http_method || 'POST';
    const targetUrl = payload.target_url.trim();
    const targetScope =
      payload.target_scope?.trim() || cronEndpointScope(httpMethod, new URL(targetUrl).pathname);

    await dbCreateCronJob(uuidv7(), {
      name: payload.name,
      description: payload.description,
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
