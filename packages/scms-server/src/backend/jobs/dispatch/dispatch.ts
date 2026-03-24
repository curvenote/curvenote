import type { FollowOnEnvelope } from '@curvenote/scms-core';
import { getConfig } from '../../../app-config.server.js';
import { createHandshakeToken } from '../../sign.handshake.server.js';
import { sendJobPubSubMessage } from '../pubsub.server.js';

/**
 * Parameters for dispatching a job via the centralized Pub/Sub topic.
 * Mirrors the shape of CreateJob but is decoupled from the DB layer —
 * the dispatch endpoint creates the row, not the caller.
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
 * In dev/test mode, calls the local dispatch endpoint directly (unless DEV_PUBSUB_DISPATCH=true).
 *
 * Returns the Pub/Sub messageId (or 'testPubSubId' in dev/test).
 */
async function sendDispatchMessage(
  data: Record<string, unknown>,
  attributes: DispatchMessageAttributes,
): Promise<string> {
  const config = await getConfig();
  if (!config.api.dispatchTopic || !config.api.dispatchProjectId) {
    throw new Error(
      'dispatchTopic and dispatchProjectId must be set in app config to use Pub/Sub job dispatch',
    );
  }

  const port = process.env.PORT ?? '3031';
  const useDevHttpStub =
    process.env.NODE_ENV === 'development' && process.env.DEV_PUBSUB_DISPATCH !== 'true';
  const dispatchDevUrl = `http://127.0.0.1:${port}/v1/jobs/dispatch`;
  const devLocalPush = useDevHttpStub ? { url: dispatchDevUrl } : undefined;

  if (useDevHttpStub) {
    console.log('[dispatch] publishing to local endpoint', dispatchDevUrl, attributes.job_type);
  }

  return sendJobPubSubMessage({
    attributes,
    data,
    pubSub: {
      projectId: config.api.dispatchProjectId,
      credentialsJson: config.api.dispatchSASecretKeyfile!,
      topicName: config.api.dispatchTopic,
    },
    devLocalPush,
  });
}

/**
 * Dispatch a job by publishing a message to the scmsJobDispatch Pub/Sub topic.
 *
 * The caller gets back a job_id immediately. The dispatch endpoint (receiving
 * the Pub/Sub push) creates the DB row and runs the handler.
 *
 * In test mode, returns immediately without publishing.
 */
export async function dispatchAJob(params: DispatchJobParams): Promise<DispatchResult> {
  const config = await getConfig();

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
