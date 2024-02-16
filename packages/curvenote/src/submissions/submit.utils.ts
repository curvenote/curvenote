import {
  buildSite,
  clean,
  collectAllBuildExportOptions,
  localArticleExport,
  selectors,
} from 'myst-cli';
import path from 'node:path';
import type { ISession } from '../session/types.js';
import type { TransferDataItem } from './utils.transfer.js';
import { loadTransferFile } from './utils.transfer.js';
import { addOxaTransformersToOpts, confirmOrExit } from '../utils/utils.js';
import chalk from 'chalk';
import { format } from 'date-fns';
import {
  getFromJournals,
  postNewSubmission,
  postNewWork,
  postNewWorkVersion,
  postUpdateSubmissionWorkVersion,
} from './utils.js';
import inquirer from 'inquirer';

export type SubmitOpts = {
  kind?: string;
  yes?: boolean;
  info: boolean;
  draft?: boolean;
  repo?: string;
  branch?: string;
  path?: string;
  commit?: string;
};

export function kindQuestions(kinds: { name: string }[]) {
  return {
    name: 'kinds',
    type: 'list',
    message: 'What kind of submission are you making?',
    choices: kinds.map(({ name }) => ({ name, value: name })),
  };
}

export function venueQuestion(session: ISession) {
  return {
    name: 'venue',
    type: 'input',
    message: 'Enter the venue name you want to submit to?',
    filter: (venue: string) => venue.toLowerCase(),
    validate: async (venue: string) => {
      if (venue.length < 3) {
        return 'Venue name must be at least 3 characters';
      }
      try {
        await getFromJournals(session, `sites/${venue}`);
      } catch (err) {
        return `Venue "${venue}" not found.`;
      }
      return true;
    },
  };
}

export async function determineSubmissionKind(
  session: ISession,
  venue: string,
  opts?: { kind?: string },
) {
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
    const match = kinds.items.find(
      ({ name }: { name: string }) => name.toLowerCase() === opts.kind?.toLowerCase(),
    );
    if (!match) {
      session.log.info(
        `${chalk.red(`🚨 submission kind "${opts.kind}" is not accepted at venue ${venue}`)}`,
      );
      process.exit(1);
    }
    // Return the actual kind (including case)
    kind = match.name;
  } else if (kinds.items.length === 1) {
    kind = kinds.items[0].name;
  } else {
    const response = await inquirer.prompt([kindQuestions(kinds.items)]);
    kind = response.kinds;
  }
  session.log.debug(`resolved kind to ${kind}`);
  return kind;
}

export async function performCleanRebuild(session: ISession, opts?: SubmitOpts) {
  session.log.info('\n\n\t✨✨✨  performing a clean re-build of your work  ✨✨✨\n\n');
  await clean(session, [], { site: true, html: true, temp: true, exports: true, yes: true });
  const exportOptionsList = await collectAllBuildExportOptions(session, [], { all: true });
  const exportLogList = exportOptionsList.map((exportOptions) => {
    return `${path.relative('.', exportOptions.$file)} -> ${exportOptions.output}`;
  });
  session.log.info(`📬 Performing exports:\n   ${exportLogList.join('\n   ')}`);
  await localArticleExport(session, exportOptionsList, {});
  session.log.info(`⛴  Exports complete`);
  // Build the files in the content folder and process them
  await buildSite(session, addOxaTransformersToOpts(session, opts ?? {}));
  session.log.info(`✅ Work rebuild complete`);
}

export function getSiteConfig(session: ISession) {
  const siteConfig = selectors.selectCurrentSiteConfig(session.store.getState());
  if (!siteConfig) {
    throw new Error('🧐 No site config found.');
  }
  return siteConfig;
}

export async function getTransferData(session: ISession, opts?: SubmitOpts) {
  session.log.debug('Checking for a "transfer.yml" file...');
  const transferData = await loadTransferFile(session);
  if (transferData) {
    if (!opts?.draft) {
      session.log.info(`${chalk.bold(`🧐 Found a "transfer.yml" in this folder.`)}`);
    } else {
      session.log.info(
        `${chalk.bold(
          `🙈 Found a "transfer.yml", but ignoring it as you are submitting a draft.`,
        )}`,
      );
      return undefined;
    }
  }
  return transferData;
}

export async function ensureVenue(session: ISession, venue: string | undefined) {
  if (venue) return venue;
  session.log.debug('No venue provided, prompting user...');
  const answer = await inquirer.prompt([venueQuestion(session)]);
  return answer.venue;
}

export async function checkVenueExists(session: ISession, venue: string) {
  try {
    session.log.debug(`GET from journals API sites/${venue}`);
    await getFromJournals(session, `sites/${venue}`);
    session.log.debug(`found venue "${venue}"`);
  } catch (err) {
    session.log.debug(err);
    session.log.error(`${chalk.red(`👩🏻‍🔬 venue "${venue}" not found.`)}`);
    process.exit(1);
  }
}

export async function checkVenueAccess(session: ISession, venue: string) {
  try {
    await getFromJournals(session, `sites/${venue}/access`);
    session.log.info(`${chalk.green(`💚 venue "${venue}" is accepting submissions.`)}`);
  } catch (err) {
    session.log.info(`${chalk.red(`🚦 venue "${venue}" is not accepting submissions.`)}`);
    process.exit(1);
  }
}

export async function confirmUpdateToExistingSubmission(
  session: ISession,
  venue: string,
  venueTransferData: TransferDataItem,
  opts?: SubmitOpts,
) {
  session.log.debug('found venue in transfer.yml, existing submission');
  const lastSubDate = venueTransferData.submissionVersion?.date_created;
  session.log.info(
    chalk.bold(
      `🗓 you last submitted this work to "${venue}" on ${
        lastSubDate ? format(new Date(lastSubDate), 'dd MMM, yyyy HH:mm:ss') : 'unknown'
      }.`,
    ),
  );

  session.log.info(`📡 Checking submission status...`);

  let existingSubmission;
  try {
    session.log.debug(
      `GET from journals API sites/${venue}/submissions/${venueTransferData.submission?.id}`,
    );
    existingSubmission = await getFromJournals(
      session,
      `sites/${venue}/submissions/${venueTransferData.submission?.id}`,
    );
  } catch (err: any) {
    session.log.debug(err);
    session.log.info(
      `${chalk.red(`🚨 submission not found, or you do not have permission to update it`)}`,
    );
    process.exit(1);
  }
  session.log.info(
    `✅ Submission found, ${existingSubmission?.versions.length} version${
      existingSubmission?.versions.length > 1 ? 's' : ''
    } present, latest status: ${existingSubmission?.versions[0].status}.`,
  );

  try {
    session.log.debug(`GET from journals API my/works/${venueTransferData.work?.id}`);
    await getFromJournals(session, `my/works/${venueTransferData.work?.id}`);
  } catch (err) {
    session.log.debug(err);
    session.log.info(
      `${chalk.red(
        `🚨 the work related to your submission was not found, or you do not have permission to update it`,
      )}`,
    );
    process.exit(1);
  }

  if (opts?.kind) {
    session.log.info(
      `🪧  NOTE: the --kind option was provided, but will be ignored as you are updating an existing submission`,
    );
  }
  const kind = existingSubmission?.kind;
  session.log.debug(`resolved kind to ${kind}`);

  await confirmOrExit(
    `Update your submission to "${venue}" based on the contents of your local folder?`,
    opts,
  );

  return kind;
}

export async function createNewSubmission(
  session: ISession,
  venue: string,
  kind: string,
  cdnKey: string,
  opts?: SubmitOpts,
) {
  session.log.debug(`posting new work...`);
  const { work, workVersion } = await postNewWork(session, cdnKey, session.PRIVATE_CDN);
  session.log.debug(`work posted with id ${work.id}`);

  session.log.debug(`posting new submission...`);
  const { submission, submissionVersion } = await postNewSubmission(
    session,
    venue,
    kind,
    workVersion.id,
    opts?.draft ?? false,
  );

  session.log.debug(`new submission posted with id ${submission.id}`);

  if (opts?.draft) {
    session.log.info(`🚀 ${chalk.green(`Your draft was successfully submitted to "${venue}"`)}.`);
  } else {
    session.log.info(`🚀 ${chalk.green(`Your work was successfully submitted to "${venue}"`)}.`);
  }

  return { work, workVersion, submission, submissionVersion };
}

export async function updateExistingSubmission(
  session: ISession,
  venue: string,
  cdnKey: string,
  venueTransferData: TransferDataItem,
) {
  session.log.debug(`existing submission - upload & post`);
  const workId = venueTransferData.work?.id;
  const submissionId = venueTransferData.submission?.id;
  if (!workId) {
    session.log.error('🚨 No work id found - invalid transfer.yml');
    process.exit(1);
  }
  if (!submissionId) {
    session.log.error('🚨 No submission id found - invalid transfer.yml');
    process.exit(1);
  }
  try {
    session.log.debug(`posting new work version...`);
    const { work, workVersion } = await postNewWorkVersion(
      session,
      workId,
      cdnKey,
      session.PRIVATE_CDN,
    );
    session.log.debug(`work version posted with id ${workVersion.id}`);

    session.log.debug(`posting new version to existing submission...`);
    const { submission, submissionVersion } = await postUpdateSubmissionWorkVersion(
      session,
      venue,
      submissionId,
      workVersion.id,
    );

    session.log.debug(`submission version posted with id ${submissionVersion.id}`);

    session.log.info(
      `🚀 ${chalk.bold.green(`Your submission was successfully updated at "${venue}"`)}.`,
    );

    return {
      work,
      workVersion,
      submission,
      submissionVersion,
    };
  } catch (err: any) {
    session.log.info(`\n\n🚨 ${chalk.bold.red('Could not update your submission')}.`);
    session.log.info(`📣 ${chalk.red(err.message)}.`);
    process.exit(1);
  }
}
