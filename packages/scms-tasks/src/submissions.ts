/**
 * Submissions API: PUT submission status.
 * Used by SCMSClient; handler shape is uniform with jobs, works, uploads.
 */

import type { Response } from 'express';
import { scmsRequest } from './utils.js';

export type SubmissionsHandler = {
  putStatus: (status: string, userId: string, res: Response) => Promise<void>;
};

/**
 * Create the submissions handler for SCMSClient (putStatus).
 */
export function createSubmissionsHandler(
  statusUrl: string,
  handshake: string,
  loggingOnlyMode: boolean,
): SubmissionsHandler {
  return {
    async putStatus(status: string, userId: string, res: Response): Promise<void> {
      await scmsRequest({
        method: 'PUT',
        url: statusUrl,
        body: { status, userId },
        authToken: handshake,
        res,
        contextLabel: 'putting status',
        loggingOnlyMode,
      });
    },
  };
}
