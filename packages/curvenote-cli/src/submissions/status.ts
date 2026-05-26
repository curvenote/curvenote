import type { MySubmissionsListingDTO } from '@curvenote/common';
import type { ISession } from '../session/types.js';
import { checkVenueExists, ensureVenue } from '../sites/utils.js';
import { getFromJournals } from '../utils/api.js';
import { exitOnInvalidKeyOption, getMyWorksFromDoi, workKeyFromConfig } from '../works/utils.js';
import { getAllSubmissionsThatICanSeeUsingKey, getSubmissionToUpdate } from './submit.utils.js';
import type { STATUS_ACTIONS } from './types.js';
import { patchUpdateSubmissionStatus } from './utils.js';
import { keyFromTransferFile } from './utils.transfer.js';

export type StatusOptions = {
  force?: boolean;
  date?: boolean | string;
  // Update status based on doi rather than project.id
  doi?: string;
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

  const doiTrimmed =
    typeof opts.doi === 'string' && opts.doi.trim().length > 0 ? opts.doi.trim() : undefined;

  let existing: Awaited<ReturnType<typeof getSubmissionToUpdate>>;

  if (doiTrimmed) {
    session.log.info(`📍 Updating submission status using DOI: ${doiTrimmed}`);
    const works = await getMyWorksFromDoi(session, doiTrimmed);
    if (!works.length) {
      session.log.error(`⛔️ No work found for DOI "${doiTrimmed}"`);
      process.exit(1);
    }
    const work = works[0];
    const mine = (await getFromJournals(
      session,
      `/my/submissions/?work_id=${encodeURIComponent(work.id)}&site=${encodeURIComponent(venue)}`,
    )) as MySubmissionsListingDTO;
    const found = mine.items.find(
      (s) => s.site_name === venue && s.active_version.work_id === work.id,
    );
    if (!found) {
      session.log.error(
        `⛔️ No existing submission found to ${action} for DOI "${doiTrimmed}" at venue "${venue}"`,
      );
      process.exit(1);
    }
    existing = await getSubmissionToUpdate(session, [found]);
    if (!existing) {
      session.log.error(`⛔️ Could not select submission to ${action} for DOI "${doiTrimmed}"`);
      process.exit(1);
    }
    session.log.debug(`Found existing submission for DOI ${doiTrimmed}: ${existing.id}`);
  } else {
    let key = workKeyFromConfig(session);
    // Deprecation step to handle old transfer.yml files
    key = (await keyFromTransferFile(session, venue, key)) ?? key;

    if (!key) {
      session.log.error(`⛔️ No id in project config`);
      process.exit(1);
    }

    exitOnInvalidKeyOption(session, key);

    session.log.info(`📍 Updating submission status using a key: ${key}`);
    const allExisting = await getAllSubmissionsThatICanSeeUsingKey(session, venue, key);
    existing = allExisting ? await getSubmissionToUpdate(session, allExisting) : undefined;
    if (!existing) {
      session.log.error(`⛔️ No existing submission found to ${action} with key: ${key}`);
      process.exit(1);
    }
    session.log.debug(`Found existing submission with key/id: ${key}/${existing.id}`);
  }
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
