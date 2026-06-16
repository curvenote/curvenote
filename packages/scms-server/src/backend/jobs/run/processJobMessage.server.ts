import { getConfig } from '../../../app-config.server.js';
import { verifyHandshakeToken } from '../../sign.handshake.server.js';
import { getPrismaClient } from '../../prisma.server.js';
import type { JobQueueDeliveryMetadata, JobQueueMessage } from '../enqueue/queueProviders/types.js';
import { MAX_JOB_QUEUE_DELIVERY_ATTEMPTS } from '../jobQueueConstants.server.js';
import { handleTransportFailure } from './handleTransportFailure.server.js';
import { runHandler, type RunHandlerOptions } from './runHandler.server.js';

export { MAX_JOB_QUEUE_DELIVERY_ATTEMPTS } from '../jobQueueConstants.server.js';

export type ProcessJobMessageOptions = Omit<RunHandlerOptions, 'handshakeJob'>;

/**
 * Verify handshake JWT, then run the job handler.
 * Auth failures are permanent (no retry). Handler throws retry until max attempts.
 */
export async function processJobMessage(
  message: JobQueueMessage,
  metadata: JobQueueDeliveryMetadata,
  options?: ProcessJobMessageOptions,
): Promise<void> {
  const config = await getConfig();

  console.log('[processJobMessage] received', {
    job_id: message.job_id,
    job_type: message.job_type,
    deliveryCount: metadata.deliveryCount,
    messageId: metadata.messageId,
    topicName: 'job',
  });

  let claims: { jobId: string; aud: string };
  try {
    claims = verifyHandshakeToken(
      message.handshake,
      config.api.handshakeIssuer,
      config.api.handshakeSigningSecret,
    );
  } catch {
    console.error('[processJobMessage] invalid handshake — permanent failure', {
      job_id: message.job_id,
    });
    await handleTransportFailure(message.job_id, {
      reason: 'invalid_handshake',
      source: 'dead_letter',
      last_error: 'Invalid handshake token',
    });
    return;
  }

  if (claims.jobId !== message.job_id) {
    console.error('[processJobMessage] handshake jobId mismatch — permanent failure', {
      claim_job_id: claims.jobId,
      message_job_id: message.job_id,
    });
    await handleTransportFailure(message.job_id, {
      reason: 'invalid_handshake',
      source: 'dead_letter',
      last_error: 'Handshake jobId does not match message job_id',
    });
    return;
  }

  if (claims.aud !== message.job_type) {
    console.error('[processJobMessage] handshake aud mismatch — permanent failure', {
      claim_aud: claims.aud,
      message_job_type: message.job_type,
    });
    await handleTransportFailure(message.job_id, {
      reason: 'invalid_handshake',
      source: 'dead_letter',
      last_error: 'Handshake aud does not match message job_type',
    });
    return;
  }

  const prisma = await getPrismaClient();
  const jobRow = await prisma.job.findUnique({ where: { id: message.job_id } });
  if (jobRow && jobRow.job_type !== message.job_type) {
    console.error('[processJobMessage] job row type mismatch — permanent failure', {
      row_job_type: jobRow.job_type,
      message_job_type: message.job_type,
    });
    await handleTransportFailure(message.job_id, {
      reason: 'invalid_handshake',
      source: 'dead_letter',
      last_error: 'Job row job_type does not match message job_type',
    });
    return;
  }

  try {
    await runHandler(message.job_id, {
      handshakeJob: { jobId: message.job_id, jobType: message.job_type },
      ...options,
    });
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error('[processJobMessage] handler threw', {
      job_id: message.job_id,
      deliveryCount: metadata.deliveryCount,
      errMessage,
    });

    if (metadata.deliveryCount >= MAX_JOB_QUEUE_DELIVERY_ATTEMPTS) {
      await handleTransportFailure(message.job_id, {
        reason: 'transport_exhausted',
        source: 'dead_letter',
        last_error: errMessage,
      });
      return;
    }

    throw err;
  }
}
