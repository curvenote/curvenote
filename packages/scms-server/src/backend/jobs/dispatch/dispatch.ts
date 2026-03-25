import type { FollowOnEnvelope } from '@curvenote/scms-core';
import { JobStatus } from '@curvenote/scms-db';
import { getConfig } from '../../../app-config.server.js';
import { getPrismaClient } from '../../prisma.server.js';
import { createHandshakeToken } from '../../sign.handshake.server.js';
import { dbCreateJob } from '../handlers/db.server.js';
import { sendJobPubSubMessage } from '../pubsub.server.js';

/**
 * Parameters for dispatching a job via the centralized Pub/Sub topic.
 * Mirrors the shape of CreateJob; `dispatchAJob` persists a QUEUED row before publishing.
 */
export interface DispatchJobParams {
  job_id: string;
  job_type: string;
  payload: Record<string, any>;
  invoked_by_id?: string;
  activity_type?: string;
  activity_data?: Record<string, unknown>;
  follow_on?: FollowOnEnvelope;
}

export interface DispatchResult {
  job_id: string;
  job_type: string;
  status: 'DISPATCHED';
}

type DispatchMessageAttributes = {
  handshake: string;
  job_type: string;
};

/**
 * Publish a job dispatch message to the centralized scmsJobDispatch Pub/Sub topic.
 *
 * Routing (handled by sendJobPubSubMessage):
 *  - test → fake ID, no publish
 *  - PUBSUB_EMULATOR_HOST set → publishes to emulator (real PubSub client)
 *  - development (no emulator) → HTTP stub POST to localhost dispatch endpoint
 *  - production → real GCP Pub/Sub
 */
async function sendDispatchMessage(
  data: Record<string, unknown>,
  attributes: DispatchMessageAttributes,
): Promise<string> {
  const config = await getConfig();
  if (
    !process.env.PUBSUB_EMULATOR_HOST &&
    process.env.NODE_ENV !== 'development' &&
    process.env.NODE_ENV !== 'test' &&
    (!config.api.dispatchTopic || !config.api.dispatchSASecretKeyfile)
  ) {
    throw new Error(
      'dispatchTopic and dispatchSASecretKeyfile must be set in app config to use Pub/Sub job dispatch',
    );
  }

  const port = process.env.PORT ?? '3031';
  const devLocalPushUrl = `http://127.0.0.1:${port}/v1/jobs/dispatch`;

  return sendJobPubSubMessage({
    attributes,
    data,
    pubSub: {
      projectId: config.api.pubsubProjectId ?? 'curvenote-dev-1',
      credentialsJson: config.api.dispatchSASecretKeyfile ?? '{}',
      topicName: config.api.dispatchTopic ?? 'scmsJobDispatch',
    },
    devLocalPush: { url: devLocalPushUrl },
  });
}

/**
 * Insert QUEUED job row if absent (idempotent). Skips when a row already exists so
 * retries and duplicate dispatches do not violate unique constraints.
 */
async function ensureQueuedJobRow(params: DispatchJobParams): Promise<void> {
  const prisma = await getPrismaClient();
  const existing = await prisma.job.findUnique({ where: { id: params.job_id } });
  if (existing) {
    return;
  }
  await dbCreateJob({
    id: params.job_id,
    job_type: params.job_type,
    payload: params.payload,
    status: JobStatus.QUEUED,
    follow_on: params.follow_on,
    invoked_by_id: params.invoked_by_id,
    activity_type: params.activity_type,
  });
}

/**
 * Dispatch a job by publishing a message to the centralized scmsJobDispatch Pub/Sub topic.
 *
 * Creates the DB row (QUEUED) before publishing so callers can rely on the job existing
 * immediately (serverless-safe). The dispatch endpoint still ensures a row exists for
 * Pub/Sub retries and any out-of-band publishes.
 *
 * In test mode, the row is still created; Pub/Sub publish is skipped.
 */
export async function dispatchAJob(params: DispatchJobParams): Promise<DispatchResult> {
  const config = await getConfig();

  await ensureQueuedJobRow(params);

  const handshake = createHandshakeToken(
    params.job_id,
    params.job_type,
    config.api.handshakeIssuer,
    config.api.handshakeSigningSecret,
  );

  await sendDispatchMessage(
    {
      job_id: params.job_id,
      job_type: params.job_type,
      payload: params.payload,
      invoked_by_id: params.invoked_by_id,
      activity_type: params.activity_type,
      activity_data: params.activity_data,
      follow_on: params.follow_on,
    },
    {
      handshake,
      job_type: params.job_type,
    },
  );

  return {
    job_id: params.job_id,
    job_type: params.job_type,
    status: 'DISPATCHED',
  };
}
