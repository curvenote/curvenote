import type { Context } from '../../context.server.js';
import type { CreateJob } from '@curvenote/scms-core';
import { startCheckProcessingService } from '../processing/index.js';
import { createHandshakeToken } from '../../sign.handshake.server.js';
import { getPrismaClient } from '../../prisma.server.js';
import { JobStatus } from '@curvenote/scms-db';
import { dbStartJob } from './db.server.js';
import { workerJobUrl } from '../workerJobUrl.server.js';

export async function checkHandler(ctx: Context, data: CreateJob) {
  const { id, job_type, payload } = data;
  try {
    const job_url = workerJobUrl(ctx, `/jobs/${id}`);
    // Besides job_type, remaining payload is passed directly to pub/sub queue and validated later
    await startCheckProcessingService(
      {
        handshake: createHandshakeToken(
          id,
          job_type,
          ctx.$config.api.handshakeIssuer,
          ctx.$config.api.handshakeSigningSecret,
        ),
        job_url,
        job_id: id,
        ...payload,
      },
      {
        job_id: id,
        job_type,
        payload,
      },
    );
    return dbStartJob({ ...data, status: JobStatus.RUNNING });
  } catch (error) {
    console.error(error);
    const statusText = 'Unable to publish job to pub/sub';
    console.error('422', statusText);
    throw new Response(null, { status: 422, statusText });
  }
}

export async function checkCLIHandler(ctx: Context, data: CreateJob) {
  const prisma = await getPrismaClient();
  const existing = await prisma.job.findUnique({ where: { id: data.id } });
  if (existing) {
    // Row created at POST /v1/jobs; CLI updates status via PATCH (API token, not queue).
    return existing;
  }
  return dbStartJob(data);
}
