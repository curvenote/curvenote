import type { ISession } from '../session/types.js';
import type { STATUS_ACTIONS } from '../utils/types.js';
import { checkForSubmissionUsingKey, checkVenueExists, ensureVenue } from './submit.utils.js';
import { getGitRepoInfo } from './utils.git.js';
import { exitOnInvalidKeyOption, patchUpdateSubmissionStatus } from './utils.js';
import { loadTransferFile } from './utils.transfer.js';

type SubmissionOpts = {
  key?: string;
};

async function updateStatus(
  action: STATUS_ACTIONS,
  session: ISession,
  venue: string,
  opts?: SubmissionOpts,
) {
  if (session.isAnon) {
    throw new Error(
      '⛔️ You must be authenticated for this command. Use `curvenote token set [token]`',
    );
  }

  exitOnInvalidKeyOption(session, opts?.key);

  const transferData = await loadTransferFile(session);
  venue = await ensureVenue(session, venue);
  await checkVenueExists(session, venue);
  // TODO check user scope on this venue! await checkVenueAccess(session, venue);

  session.log.debug('Generating git info');
  const gitInfo = await getGitRepoInfo();
  if (opts?.key === 'git' && gitInfo == null) {
    session.log.error(
      `🚨 You are trying to generate a key from git but you are not in a git repository, try specifying a persistent '--key' instead.`,
    );
    process.exit(1);
  }

  const key = opts?.key == 'git' ? gitInfo?.key : opts?.key;
  let submissionId: string | undefined;
  if (key) {
    session.log.info(`📍 Updating submission status using a key: ${key}`);
    const existing = await checkForSubmissionUsingKey(session, venue, key);
    if (!existing) {
      session.log.error(`⛔️ No existing submission found with key: ${key}`);
      process.exit(1);
    }
    session.log.debug(`Found existing submission with key/id: ${key}/${existing.id}`);
    submissionId = existing.id;
  } else if (transferData == null) {
    session.log.error('⛔️ No existing submission found, ./transfer.yml file does not exist');
    process.exit(1);
  } else {
    session.log.debug('Checking for existing submission using transfer.yml');
    submissionId = transferData?.[venue]?.submission?.id;
  }

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

export async function publish(session: ISession, venue: string, opts?: SubmissionOpts) {
  await updateStatus('publish', session, venue, opts);
}

export async function unpublish(session: ISession, venue: string, opts?: SubmissionOpts) {
  await updateStatus('unpublish', session, venue, opts);
}
