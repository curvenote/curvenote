import type { ISession } from '../session/types.js';
import type { STATUSES } from '../utils/types.js';
import { patchUpdateSubmissionStatus } from './utils.js';
import { loadTransferFile } from './utils.transfer.js';

async function updateStatus(status: STATUSES, session: ISession, venue: string) {
  if (session.isAnon) {
    throw new Error(
      '⛔️ You must be authenticated for this command. Use `curvenote token set [token]`',
    );
  }
  const verb = status === 'PUBLISHING' ? 'publish' : 'unpublish';
  const transferData = await loadTransferFile(session);
  const submissionId = transferData?.[venue]?.submission?.id;
  if (!submissionId) {
    let message = '';
    if (!transferData) message = ', ./transfer.yml file does not exist';
    else if (!transferData?.[venue]) message = `, venue "${venue}" is unknown`;
    session.log.error(
      `⛔️ No existing submission found to ${verb}${message}. Use 'curvenote submit ${venue}' to create a submission.`,
    );
    process.exit(1);
  }
  await patchUpdateSubmissionStatus(session, venue, submissionId, status);
}

export async function publish(session: ISession, venue: string) {
  await updateStatus('PUBLISHING', session, venue);
}

export async function unpublish(session: ISession, venue: string) {
  await updateStatus('UNPUBLISHING', session, venue);
}
