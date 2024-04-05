import type { ISession } from '../session/types.js';
import type { STATUS_ACTIONS } from '../utils/types.js';
import { workKeyFromConfig } from '../works/utils.js';
import {
  checkVenueExists,
  ensureVenue,
  getAllSubmissionsUsingKey,
  getSubmissionToUpdate,
} from './submit.utils.js';
import { exitOnInvalidKeyOption, patchUpdateSubmissionStatus } from './utils.js';
import { keyFromTransferFile } from './utils.transfer.js';

async function updateStatus(action: STATUS_ACTIONS, session: ISession, venue: string) {
  if (session.isAnon) {
    throw new Error(
      '⛔️ You must be authenticated for this command. Use `curvenote token set [token]`',
    );
  }
  venue = await ensureVenue(session, venue);
  await checkVenueExists(session, venue);
  // TODO check user scope on this venue! await checkVenueAccess(session, venue);

  let key = workKeyFromConfig(session);
  // Deprecation step to handle old transfer.yml files
  key = (await keyFromTransferFile(session, venue, key)) ?? key;

  if (!key) {
    session.log.error(`⛔️ No id in project config`);
    process.exit(1);
  }

  exitOnInvalidKeyOption(session, key);

  session.log.info(`📍 Updating submission status using a key: ${key}`);
  const allExisting = await getAllSubmissionsUsingKey(session, venue, key);
  const existing = allExisting ? await getSubmissionToUpdate(session, allExisting) : undefined;
  if (!existing) {
    session.log.error(`⛔️ No existing submission found to ${action} with key: ${key}`);
    process.exit(1);
  }
  session.log.debug(`Found existing submission with key/id: ${key}/${existing.id}`);

  await patchUpdateSubmissionStatus(session, venue, existing.links.self, action);
}

export async function publish(session: ISession, venue: string) {
  await updateStatus('publish', session, venue);
}

export async function unpublish(session: ISession, venue: string) {
  await updateStatus('unpublish', session, venue);
}
