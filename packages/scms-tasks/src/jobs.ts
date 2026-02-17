/**
 * Jobs API: PATCH job status (completed, failed, running).
 * Used by SCMSClient; handler shape is uniform with works, submissions, uploads.
 */

import type { Response } from 'express';
import { send, alreadySent, scmsRequest } from './utils.js';

export type JobsHandler = {
  completed: (
    res: Response,
    message: string,
    results: Record<string, unknown>,
  ) => Promise<Response>;
  failed: (res: Response, message: string, results?: Record<string, unknown>) => Promise<Response>;
  running: (res: Response, message: string, results?: Record<string, unknown>) => Promise<void>;
};

function patchJobStatus(
  jobUrl: string,
  handshake: string,
  loggingOnlyMode: boolean,
  status: string,
  results: Record<string, unknown> | undefined,
  message: string,
  res: Response,
): Promise<void> {
  const body: Record<string, unknown> = { status, message };
  if (results) body.results = results;
  return scmsRequest({
    method: 'PATCH',
    url: jobUrl,
    body,
    authToken: handshake,
    res,
    contextLabel: 'patching job',
    loggingOnlyMode,
  });
}

/**
 * Create the jobs handler for SCMSClient (completed, failed, running).
 */
export function createJobsHandler(
  jobUrl: string,
  handshake: string,
  loggingOnlyMode: boolean,
): JobsHandler {
  return {
    async completed(res, message, results): Promise<Response> {
      if (loggingOnlyMode) {
        console.log('[loggingOnlyMode] Skipping COMPLETED request');
        return alreadySent(res) ? res : send(res, 200);
      }
      await patchJobStatus(jobUrl, handshake, loggingOnlyMode, 'COMPLETED', results, message, res);
      return send(res, 200);
    },

    async failed(res, message, results): Promise<Response> {
      if (loggingOnlyMode) {
        console.log('[loggingOnlyMode] Skipping FAILED request');
        return alreadySent(res) ? res : send(res, 200);
      }
      await patchJobStatus(jobUrl, handshake, loggingOnlyMode, 'FAILED', results, message, res);
      return alreadySent(res) ? res : send(res, 200);
    },

    async running(res, message, results): Promise<void> {
      if (loggingOnlyMode) {
        console.log('[loggingOnlyMode] Skipping RUNNING request');
        return;
      }
      await patchJobStatus(jobUrl, handshake, loggingOnlyMode, 'RUNNING', results, message, res);
    },
  };
}
