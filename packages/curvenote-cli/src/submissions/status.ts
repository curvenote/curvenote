import type { ISession } from '../session/types.js';
import type { STATUS_ACTIONS } from '../utils/types.js';
import { patchUpdateSubmissionStatus } from './utils.js';
import { loadTransferFile } from './utils.transfer.js';

async function updateStatus(action: STATUS_ACTIONS, session: ISession, venue: string) {
  if (session.isAnon) {
    throw new Error(
      '⛔️ You must be authenticated for this command. Use `curvenote token set [token]`',
    );
  }
  const transferData = await loadTransferFile(session);
  const submissionId = transferData?.[venue]?.submission?.id;
  if (!submissionId) {
    let message = '';
    if (!transferData) message = ', ./transfer.yml file does not exist';
    else if (!transferData?.[venue]) message = `, venue "${venue}" is unknown`;
    session.log.error(
      `⛔️ No existing submission found to ${action}${message}. Use 'curvenote submit ${venue}' to create a submission.`,
    );
    process.exit(1);
  }
  await patchUpdateSubmissionStatus(session, venue, submissionId, action);
}

export async function publish(session: ISession, venue: string) {
  await updateStatus('publish', session, venue);
}

export async function unpublish(session: ISession, venue: string) {
  await updateStatus('unpublish', session, venue);
}
