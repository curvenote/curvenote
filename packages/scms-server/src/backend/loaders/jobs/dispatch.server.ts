import { uuidv7 } from 'uuidv7';
import type { FollowOnEnvelope } from '@curvenote/scms-core';
import { getConfig } from '../../../app-config.server.js';
import { createHandshakeToken } from '../../sign.handshake.server.js';
import { publishDispatchMessage } from '../../processing.server.js';

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

/**
 * Dispatch a job by publishing a message to the scmsJobDispatch Pub/Sub topic.
 *
 * The caller gets back a job_id immediately. The dispatch endpoint (receiving
 * the Pub/Sub push) creates the DB row and runs the handler.
 *
 * In test mode, returns immediately without publishing.
 */
export async function dispatchJob(params: DispatchJobParams): Promise<DispatchResult> {
  const config = await getConfig();

  const handshake = createHandshakeToken(
    params.job_id,
    params.job_type,
    config.api.handshakeIssuer,
    config.api.handshakeSigningSecret,
  );

  await publishDispatchMessage(
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

/**
 * Helper to generate a new job_id. Callers that need the ID before dispatch
 * (e.g. to store on a transition) can call this separately.
 */
export function generateJobId(): string {
  return uuidv7();
}
