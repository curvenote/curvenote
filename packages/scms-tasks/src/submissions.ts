/**
 * Submissions API: PUT submission status.
 * Used by SCMSClient; handler shape is uniform with jobs, works, uploads.
 */

import { scmsRequest } from './utils.js';

export type SubmissionsHandler = {
  putStatus: (status: string, userId: string) => Promise<void>;
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
    async putStatus(status: string, userId: string): Promise<void> {
      await scmsRequest({
        method: 'PUT',
        url: statusUrl,
        body: { status, userId },
        authToken: handshake,
        contextLabel: 'putting status',
        loggingOnlyMode,
      });
    },
  };
}
