import type { Context } from '../../../context.server.js';
import type { CreateJob } from '@curvenote/scms-core';
import { publishCheck } from '../../../processing.server.js';
import { createHandshakeToken } from '../../../sign.handshake.server.js';
import { dbCreateJob } from './db.server.js';

export async function checkHandler(ctx: Context, data: CreateJob) {
  const { id, job_type, payload } = data;
  try {
    const parsedUrl = new URL(ctx.request.url);
    const job_url = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}/${id}`;
    // Besides job_type, remaining payload is passed directly to pub/sub queue and validated later
    await publishCheck({
      handshake: createHandshakeToken(
        id,
        job_type,
        ctx.$config.api.handshakeIssuer,
        ctx.$config.api.handshakeSigningSecret,
      ),
      job_url,
      ...payload,
    });
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
