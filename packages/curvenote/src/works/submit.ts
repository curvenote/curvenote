import { selectors } from 'myst-cli';
import type { ISession } from '../session/types.js';
import { confirmOrExit } from '../utils/index.js';
import chalk from 'chalk';
import { submitToVenue } from './utils.js';
import { loadTransferFile } from './transfer.js';

export async function submit(
  session: ISession,
  venue: string,
  opts?: { ci?: boolean; yes?: boolean },
) {
  if (session.isAnon) {
    throw new Error(
      '⚠️ You must be authenticated for this call. Use `curvenote token set [token]`',
    );
  }

  const siteConfig = selectors.selectCurrentSiteConfig(session.store.getState());
  if (!siteConfig) {
    throw new Error('🧐 No site config found.');
  }

  const transferData = await loadTransferFile();
  // TODO force / ci - just create the work anyways
  if (!transferData) {
    session.log.info(
      `${chalk.bold(
        `🧐 Looks like you've not created a work on curvenote yet, run "curvenote works create" before submitting`,
      )}`,
    );
  }

  // TODO check venue exists
  session.log.info(
    `${chalk.green(`👩🏻‍🔬 venue ${venue} is accepting submissions (TODO: check for real)`)}`,
  );

  if (!transferData?.work_id || !transferData?.work_version_id) {
    session.log.info(
      `${chalk.bold(
        `🧐 It looks like your "transfer.yml" might be invalid, cannot complete your submission.`,
      )}`,
    );
    throw new Error('Exiting');
  }

  session.log.info(`🧾 Choose submission kind (TODO)`);
  const kind = 'project';

  session.log.info(
    `📖 work exists, let's confirm some details (title, desc, date, etc...) before submission (TODO)`,
  );

  await confirmOrExit(`Submit your work to "${venue}" with this metadata?`, opts);

  await submitToVenue(session, venue, transferData.work_version_id, kind);

  session.log.info(
    `\n\n🚀 ${chalk.bold.green(`Your work was successfully submitted to ${venue}`)}.`,
  );
  session.log.info(
    `The "./transfer.yml" file has been updated with the new work version's id, please commit this change.`,
  );
}
