import { $Enums } from '@curvenote/scms-db';
import type { Context } from '@curvenote/scms-core';
import type { JobDTO } from '@curvenote/common';
import { getPrismaClient } from '../../prisma.server.js';
import { error404, coerceToObject } from '@curvenote/scms-core';
import { createPreviewToken } from '../../sign.previews.server.js';

async function dbGet(id: string) {
  const prisma = await getPrismaClient();
  return prisma.job.findUnique({ where: { id } });
}

export type DBO = Exclude<Awaited<ReturnType<typeof dbGet>>, null>;

export function formatJobDTO(ctx: Context, job: DBO): JobDTO {
  const payload = coerceToObject(job.payload);
  const results = coerceToObject(job.results);

  // this is convenient but makes jobs less generic
  let signature: string | undefined;
  if (
    job.job_type === 'CHECK' &&
    job.status === $Enums.JobStatus.COMPLETED &&
    payload.journal &&
    results?.submissionId
  ) {
    signature = createPreviewToken(
      payload.journal,
      results.submissionId,
      ctx.$config.api.previewIssuer,
      ctx.$config.api.previewSigningSecret,
    );
  }

  const formatted: JobDTO = {
    id: job.id,
    date_created: job.date_created,
    date_modified: job.date_modified,
    job_type: job.job_type,
    status: job.status,
    // Payload/results should only ever be objects; however, we also coerce
    // to object here so the DTO is guaranteed consistent.
    payload,
    results: { ...results, signature },
    messages: job.messages,
    links: {
      self: ctx.asApiUrl(`/jobs/${job.id}`),
    },
  };
  return formatted;
}

export default async function (ctx: Context, jobId: string) {
  const dbo = await dbGet(jobId);
  if (!dbo) throw error404();
  return formatJobDTO(ctx, dbo);
}
