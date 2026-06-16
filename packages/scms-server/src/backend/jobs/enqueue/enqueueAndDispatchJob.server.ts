import type { EnqueueJobParams, EnqueueJobResult } from '@curvenote/scms-core';
import { KnownJobTypes } from '@curvenote/scms-core';
import { JobStatus } from '@curvenote/scms-db';
import { getConfig } from '../../../app-config.server.js';
import { getPrismaClient } from '../../prisma.server.js';
import { createHandshakeToken } from '../../sign.handshake.server.js';
import { dispatchJob } from './dispatchJob.server.js';
import { ensureJobRow } from './ensureJobRow.server.js';
import { followOnFromEnvelope } from './followOnFromEnvelope.server.js';
import { validateEnqueuePublishingScopes } from './validateEnqueuePublishingScopes.server.js';

const HANDSHAKE_EXPIRY_SECONDS = 4 * 60 * 60;

/** CLI drives lifecycle via PATCH with API token; no queue consumer work. */
const CLI_TRACKED_JOB_TYPES: ReadonlySet<string> = new Set([KnownJobTypes.CLI_CHECK]);

/**
 * Insert parent (QUEUED) + optional BLOCKED dependents, mint handshake, dispatch parent only.
 */
export async function enqueueAndDispatchJob(params: EnqueueJobParams): Promise<EnqueueJobResult> {
  const config = await getConfig();
  const prisma = await getPrismaClient();

  const dependents =
    params.dependents ?? (params.follow_on ? followOnFromEnvelope(params.follow_on) : []);

  console.log('[enqueue] enqueueAndDispatchJob: start', {
    job_id: params.job_id,
    job_type: params.job_type,
    dependent_count: dependents.length,
    provider: process.env.QUEUES_PROVIDER ?? (process.env.VERCEL === '1' ? 'vercel' : 'mock'),
  });

  await validateEnqueuePublishingScopes(params);

  await prisma.$transaction(async (tx) => {
    await ensureJobRow(
      {
        job_id: params.job_id,
        job_type: params.job_type,
        payload: params.payload,
        invoked_by_id: params.invoked_by_id,
        activity_type: params.activity_type,
        follow_on: params.follow_on,
        results: params.results,
      },
      JobStatus.QUEUED,
      tx,
    );

    for (const dep of dependents) {
      await ensureJobRow(
        {
          job_id: dep.job_id,
          job_type: dep.job_type,
          payload: dep.payload,
          invoked_by_id: params.invoked_by_id,
          activity_type: dep.activity_type,
          depends_on_job_id: params.job_id,
          trigger_on: dep.trigger_on,
        },
        JobStatus.BLOCKED,
        tx,
      );
    }
  });

  if (CLI_TRACKED_JOB_TYPES.has(params.job_type)) {
    console.log('[enqueue] enqueueAndDispatchJob: CLI-tracked job — row only, no dispatch', {
      job_id: params.job_id,
      job_type: params.job_type,
    });
    return {
      job_id: params.job_id,
      job_type: params.job_type,
      status: 'DISPATCHED',
      dependent_job_ids: dependents.length > 0 ? dependents.map((d) => d.job_id) : undefined,
    };
  }

  const handshake = createHandshakeToken(
    params.job_id,
    params.job_type,
    config.api.handshakeIssuer,
    config.api.handshakeSigningSecret,
    Math.floor(Date.now() / 1000) + HANDSHAKE_EXPIRY_SECONDS,
  );

  const { messageId } = await dispatchJob({
    job_id: params.job_id,
    job_type: params.job_type,
    handshake,
  });

  console.log('[enqueue] enqueueAndDispatchJob: dispatched', {
    job_id: params.job_id,
    job_type: params.job_type,
    messageId,
    dependent_job_ids: dependents.map((d) => d.job_id),
  });

  return {
    job_id: params.job_id,
    job_type: params.job_type,
    status: 'DISPATCHED',
    dependent_job_ids: dependents.length > 0 ? dependents.map((d) => d.job_id) : undefined,
  };
}
