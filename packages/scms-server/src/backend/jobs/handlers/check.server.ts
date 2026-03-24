import type { Context } from '../../context.server.js';
import type { CreateJob } from '@curvenote/scms-core';
import { startCheckProcessingService } from '../processing/index.js';
import { createHandshakeToken } from '../../sign.handshake.server.js';
import { dbCreateJob } from './db.server.js';

export async function checkHandler(ctx: Context, data: CreateJob) {
  const { id, job_type, payload } = data;
  try {
    const job_url = ctx.asApiUrl(`/jobs/${id}`);
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
    return dbCreateJob(data);
  } catch (error) {
    console.error(error);
    const statusText = 'Unable to publish job to pub/sub';
    console.error('422', statusText);
    throw new Response(null, { status: 422, statusText });
  }
}

export async function checkCLIHandler(ctx: Context, data: CreateJob) {
  return dbCreateJob(data);
}
