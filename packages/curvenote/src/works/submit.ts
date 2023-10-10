import { selectors } from 'myst-cli';
import type { ISession } from '../session/types.js';
import { confirmOrExit } from '../utils/index.js';
import chalk from 'chalk';
import { getFromJournals, postNewSubmission, postUpdateSubmissionWorkVersion } from './utils.js';
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

async function determineSubmissionKind(session: ISession, venue: string, opts?: { kind?: string }) {
  let kinds;
  try {
    kinds = await getFromJournals(session, `sites/${venue}/kinds`);
  } catch (err: any) {
    session.log.info(
      `${chalk.red(`🚨 could not get submission kinds listing from venue ${venue}`)}`,
    );
    process.exit(1);
  }

  let kind;
  if (opts?.kind) {
    if (
      !kinds.items
        .map(({ name }: { name: string }) => name.toLowerCase())
        .includes(opts.kind.toLowerCase())
    ) {
      session.log.info(
        `${chalk.red(`🚨 submission kind "${opts.kind}" is not accepted at venue ${venue}`)}`,
      );
      process.exit(1);
    }
    kind = opts?.kind;
  } else if (kinds.items.length === 1) {
    kind = kinds.items[0].name;
  } else {
    const response = await inquirer.prompt([kindQuestions(kinds.items)]);
    kind = response.kinds;
  }
  return kind;
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

  const transferData = await loadTransferFile(session);
  // TODO force / ci - just create the work anyways
  if (!transferData) {
    session.log.info(
      `${chalk.bold(
        `🧐 Looks like you've not created a work on curvenote yet, run "curvenote works create" before submitting`,
      )}`,
    );
  }

  if (!transferData?.work?.id || !transferData?.work_version?.id) {
    session.log.info(
      `${chalk.bold(
        `🧐 It looks like your "transfer.yml" might be invalid, cannot complete your submission.`,
      )}`,
    );
    process.exit(1);
  }

  let kind, submission, submission_version;
  if (transferData?.submission?.id) {
    // update existing submission
    // TODO do more checking here? was the current work version already submitted?
    session.log.info(
      `${chalk.bold(
        `🧐 Found a "transfer.yml" with an existing submission id: ${transferData.submission.id}.`,
      )}`,
    );

    session.log.info(
      `${chalk.green(`👩🏻‍🔬 venue ${venue} is accepting updates to existing submissions`)}`,
    );

    let existing;
    try {
      existing = await getFromJournals(session, `my/submissions/${transferData.submission.id}`);
      // check submission exists
      // check user has permission to update it - currently owns it?
      // TODO check the venue allows for updates to the submission
    } catch (err: any) {
      session.log.info(
        `${chalk.red(`👩🏻‍🔬 submission not found, or you do not have permission to update it`)}`,
      );
      process.exit(1);
    }

    if (opts?.kind) {
      session.log.info(
        `🪧  NOTE: the --kind option was provided, but will be ignored as you are updating an existing submission`,
      );
    }

    session.log.info(
      `📖 Let's confirm some details (title, desc, date, etc...) before updating the submission (TODO)`,
    );
    session.log.info(`🧾 Submission kind: ${existing.kind}`);

    await confirmOrExit(
      `Update your submission to "${existing.site_name}" based on your local folder?`,
      opts,
    );

    try {
      const data = await postUpdateSubmissionWorkVersion(
        session,
        existing.site_name,
        existing.id,
        transferData.work_version.id,
      );
      submission = data.submission;
      submission_version = data.submissionVersion;
    } catch (err: any) {
      session.log.info(`\n\n🚨 ${chalk.bold.red('Could not update your submission')}.`);
      session.log.info(`📣 ${chalk.red(err.message)}.`);
      process.exit(1);
    }
  } else {
    // new submission
    //
    // check venue exists
    try {
      await getFromJournals(session, `sites/${venue}`);
    } catch (err: any) {
      session.log.info(`${chalk.red(`👩🏻‍🔬 venue ${venue} not found, please check the venue name`)}`);
      process.exit(1);
    }

    session.log.info(`${chalk.green(`👩🏻‍🔬 venue ${venue} is accepting submissions`)}`);

    kind = await determineSubmissionKind(session, venue, opts);

    session.log.info(
      `📖 work exists, let's confirm some details (title, desc, date, etc...) before submission (TODO)`,
    );
    session.log.info(`🧾 Submission kind: ${kind}`);

    await confirmOrExit(`Submit your work to "${venue}" based on your local folder?`, opts);

    try {
      const data = await postNewSubmission(session, venue, kind, transferData.work_version.id);
      submission = data.submission;
      submission_version = data.submissionVersion;
    } catch (err: any) {
      session.log.info(`\n\n🚨 ${chalk.bold.red('Could not submit your work')}.`);
      session.log.info(`\n\n📣 ${chalk.bold(err.message)}.`);
      process.exit(1);
    }
  }
  await upwriteTransferFile(session, { submission, submission_version });
  session.log.info(
    `\n\n🚀 ${chalk.bold.green(`Your work was successfully submitted to ${venue}`)}.`,
  );
  session.log.info(
    `The "./transfer.yml" file has been updated with the new work version's id, please commit this change.`,
  );
}
