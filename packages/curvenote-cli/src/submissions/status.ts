import type { ISession } from '../session/types.js';
import { exitOnInvalidKeyOption, workKeyFromConfig } from '../works/utils.js';
import {
  checkVenueExists,
  ensureVenue,
  getAllSubmissionsUsingKey,
  getSubmissionToUpdate,
} from './submit.utils.js';
import type { STATUS_ACTIONS } from './types.js';
import { patchUpdateSubmissionStatus } from './utils.js';
import { keyFromTransferFile } from './utils.transfer.js';

type StatusOptions = {
  force?: boolean;
  date?: boolean | string;
};

export function hyphenatedFromDate(date: Date) {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function updateStatus(
  action: STATUS_ACTIONS,
  session: ISession,
  venue: string,
  opts: StatusOptions = {},
) {
  if (session.isAnon) {
    throw new Error(
      '⛔️ You must be authenticated for this command. Use `curvenote token set [token]`',
    );
  }
  venue = await ensureVenue(session, venue, { action });
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
  let date: string | undefined;
  if (action === 'publish' && opts.date) {
    if (typeof opts.date === 'string') {
      date = opts.date;
    } else if (existing.date) {
      date = hyphenatedFromDate(new Date(existing.date));
    } else {
      session.log.warn('No alternative publish date provided; using today');
    }
  }
  try {
    await patchUpdateSubmissionStatus(session, venue, existing.links.self, action, date);
  } catch (e: any) {
    if (!opts.force) throw e;
    session.log.warn(`⚠️  ${e.message}`);
  }
}

export async function publish(session: ISession, venue: string, opts: StatusOptions = {}) {
  await updateStatus('publish', session, venue, opts);
}

export async function unpublish(session: ISession, venue: string, opts: StatusOptions = {}) {
  await updateStatus('unpublish', session, venue, opts);
}
