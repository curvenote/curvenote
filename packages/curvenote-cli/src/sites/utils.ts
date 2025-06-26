import chalk from 'chalk';
import inquirer from 'inquirer';
import type { ISession } from '../session/types.js';
import { getFromJournals } from '../utils/api.js';

export async function ensureVenue(
  session: ISession,
  venue: string | undefined,
  opts: { yes?: boolean; action?: string } = { action: 'submit' },
) {
  if (venue) return venue;
  if (opts?.yes) {
    throw new Error(`⛔️ Site must be specified to continue submission`);
  }
  session.log.debug('No Site provided, prompting user...');
  const answer = await inquirer.prompt([venueQuestion(session, opts.action)]);
  return answer.venue;
}

export function venueQuestion(session: ISession, action = 'submit') {
  return {
    name: 'venue',
    type: 'input',
    message: `Enter the Site name you want to ${action} to?`,
    filter: (venue: string) => venue.toLowerCase(),
    validate: async (venue: string) => {
      if (venue.length < 3) {
        return 'Site name must be at least 3 characters';
      }
      try {
        await getFromJournals(session, `/sites/${venue}`);
      } catch (err) {
        return `Site "${venue}" not found.`;
      }
      return true;
    },
  };
}

/**
 * Ensure that a `site` exists by performing a basic request to the Site
 *
 * If Site does not exist, fails with `process.exit(1)`.
 */
export async function checkVenueExists(session: ISession, venue: string) {
  try {
    session.log.debug(`GET from journals API /sites/${venue}`);
    await getFromJournals(session, `/sites/${venue}`);
    session.log.debug(`found Site "${venue}"`);
  } catch (err) {
    session.log.debug(err);
    session.log.error(`${chalk.red(`😟 Site "${venue}" not found.`)}`);
    process.exit(1);
  }
}
