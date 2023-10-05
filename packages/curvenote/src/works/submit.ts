import { selectors } from 'myst-cli';
import type { ISession } from '../session/types.js';
import { confirmOrExit } from '../utils/index.js';
import chalk from 'chalk';
import { getFromJournals, submitToVenue } from './utils.js';
import { loadTransferFile, upwriteTransferFile } from './transfer.js';
import inquirer from 'inquirer';

function kindQuestions(kinds: { name: string }[]) {
  return {
    name: 'kinds',
    type: 'list',
    message: 'What kind of submission are you making?',
    choices: kinds.map(({ name }) => ({ name, value: name })),
  };
}

export async function submit(
  session: ISession,
  venue: string,
  opts?: { ci?: boolean; yes?: boolean; kind?: string },
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

  // check venue exists
  const site = await getFromJournals(session, `sites/${venue}`);
  if (!site.ok) {
    session.log.info(`${chalk.red(`👩🏻‍🔬 venue ${venue} not found, please check the venue name`)}`);
    process.exit(1);
  }
  session.log.info(`${chalk.green(`👩🏻‍🔬 venue ${venue} is accepting submissions`)}`);

  if (!transferData?.work_id || !transferData?.work_version_id) {
    session.log.info(
      `${chalk.bold(
        `🧐 It looks like your "transfer.yml" might be invalid, cannot complete your submission.`,
      )}`,
    );
    process.exit(1);
  }

  const kinds = await getFromJournals(session, `sites/${venue}/kinds`);
  if (!kinds.ok) {
    session.log.info(
      `${chalk.red(`🚨 could not get submission kinds listing from venue ${venue}`)}`,
    );
    process.exit(1);
  }

  let kind;
  if (opts?.kind) {
    if (
      !kinds.json.items
        .map(({ name }: { name: string }) => name.toLowerCase())
        .includes(opts.kind.toLowerCase())
    ) {
      session.log.info(
        `${chalk.red(`🚨 submission kind "${opts.kind}" is not accepted at venue ${venue}`)}`,
      );
      process.exit(1);
    }
    kind = opts?.kind;
  } else if (kinds.json.length === 1) {
    kind = kinds.json[0].name;
  } else {
    const response = await inquirer.prompt([kindQuestions(kinds.json.items)]);
    kind = response.kinds;
  }

  session.log.info(
    `📖 work exists, let's confirm some details (title, desc, date, etc...) before submission (TODO)`,
  );
  session.log.info(`🧾 Submission kind: ${kind}`);

  await confirmOrExit(`Submit your work to "${venue}" with this metadata?`, opts);

  try {
    const resp = await submitToVenue(session, venue, transferData.work_version_id, kind);
    const submission_id = resp.json.id;
    await upwriteTransferFile({ submission_id });
    session.log.info(
      `\n\n🚀 ${chalk.bold.green(`Your work was successfully submitted to ${venue}`)}.`,
    );
    session.log.info(
      `The "./transfer.yml" file has been updated with the new work version's id, please commit this change.`,
    );
  } catch (err: any) {
    session.log.info(`\n\n🚨 ${chalk.bold.red('Could not submit your work')}.`);
    session.log.info(`\n\n📣 ${chalk.bold(err.message)}.`);
  }
}
