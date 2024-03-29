import {
  buildSite,
  clean,
  collectAllBuildExportOptions,
  localArticleExport,
  selectors,
} from 'myst-cli';
import path from 'node:path';
import { v4 as uuid } from 'uuid';
import type { ISession } from '../session/types.js';
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
import type {
  CollectionDTO,
  CollectionListingDTO,
  SubmissionDTO,
  SubmissionKindDTO,
  SubmissionKindListingDTO,
  SubmissionsListItemDTO,
  SubmissionsListingDTO,
} from '@curvenote/common';
import { plural } from 'myst-common';
import { getWorkFromKey } from '../works/utils.js';

export type SubmitOpts = {
  kind?: string;
  collection?: string;
  yes?: boolean;
  info: boolean;
  draft?: boolean;
  new?: boolean;
  resume?: boolean;
  maxSizeWebp?: number;
};

export function kindQuestions(kinds: Omit<SubmissionKindDTO, 'date_created' | 'checks'>[]) {
  return {
    name: 'kinds',
    type: 'list',
    message: 'What kind of submission are you making?',
    choices: kinds.map(({ name, id }) => ({ name, value: id })),
  };
}

export function collectionMoniker(collection: CollectionDTO) {
  return `${collection.content.title} (${collection.name})` ?? collection.name;
}

export function collectionQuestions(venue: string, collections: CollectionListingDTO['items']) {
  return {
    name: 'collections',
    type: 'list',
    message: `Venue ${venue} has multiple collections open for submission. Which do you want to submit to?`,
    choices: collections.map((item) => ({
      name: collectionMoniker(item),
      value: item,
    })),
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

export async function determineCollectionAndKind(
  session: ISession,
  venue: string,
  collections: CollectionListingDTO,
  opts?: { kind?: string; collection?: string },
) {
  const openCollections = collections.items.filter((c) => c.open);
  if (openCollections.length === 0) {
    session.log.info(
      `${chalk.red(`⛔️ no collections are open for submissions at venue "${venue}"`)}`,
    );
    process.exit(1);
  }

  if (opts?.collection) session.log.debug(`Explicit collection provided: ${opts?.collection}`);
  let selectedCollection = opts?.collection
    ? openCollections.find((c) => c.name === opts?.collection)
    : undefined;

  if (opts?.collection) {
    if (!selectedCollection) {
      session.log.info(
        `${chalk.bold.red(`⛔️ collection "${opts?.collection}" does not exist at venue "${venue}"`)}`,
      );
      session.log.info(
        `${chalk.bold(`🗂  open collections are: ${openCollections.map((c) => collectionMoniker(c)).join(', ')}`)}`,
      );
      process.exit(1);
    }

    if (selectedCollection && !selectedCollection?.open) {
      session.log.info(
        `${chalk.bold.red(`⛔️ collection "${opts?.collection}" is not open for submissions at venue "${venue}"`)}`,
      );
      session.log.info(
        `${chalk.bold(`🗂  open collections are: ${openCollections.map((c) => collectionMoniker(c)).join(', ')}`)}`,
      );
      process.exit(1);
    }
  }

  if (!selectedCollection && openCollections.length === 1) {
    selectedCollection = openCollections[0];
  } else if (!selectedCollection) {
    const response = await inquirer.prompt([collectionQuestions(venue, openCollections)]);
    selectedCollection = response.collections;
  }

  if (!selectedCollection) {
    session.log.info(`${chalk.red(`⛔️ could not determine the collection to submit to`)}`);
    process.exit(1);
  }
  session.log.info(`🗂  Collection "${collectionMoniker(selectedCollection)}" selected`);

  const kind = await determineSubmissionKindFromCollection(
    session,
    venue,
    selectedCollection,
    opts,
  );

  return { collection: selectedCollection, kind };
}

export async function getSubmissionKind(
  session: ISession,
  venue: string,
  kindIdOrName: string,
): Promise<SubmissionKindDTO> {
  const kind = await getFromJournals(session, `sites/${venue}/kinds/${kindIdOrName}`);
  if (!kind) throw new Error('kind not found');
  return kind;
}

export async function listSubmissionKinds(
  session: ISession,
  venue: string,
): Promise<SubmissionKindListingDTO> {
  return getFromJournals(session, `sites/${venue}/kinds`);
}

export async function determineSubmissionKindFromCollection(
  session: ISession,
  venue: string,
  collection: CollectionDTO,
  opts?: { kind?: string },
) {
  const kinds = collection.kinds;

  let kindId;
  if (opts?.kind) {
    const match = kinds.find(
      ({ name }: { name: string }) => name.toLowerCase() === opts.kind?.toLowerCase(),
    );
    if (!match) {
      session.log.info(
        `${chalk.bold.red(`⛔️ submission kind "${opts.kind}" is not accepted in the collection "${collectionMoniker(collection)}"`)}`,
      );
      session.log.info(
        `${chalk.bold(`📚 accepted kinds are: ${kinds.map((k) => k.name).join(', ')}`)}`,
      );
      process.exit(1);
    }
    // Return the actual kind (including case)
    kindId = match.id;
    session.log.debug(`kindId from options`);
  } else if (kinds.length === 1) {
    kindId = kinds[0].id;
    session.log.debug(`kindId from only kind`);
  } else {
    const response = await inquirer.prompt([kindQuestions(kinds)]);
    kindId = response.kinds;
    session.log.debug(`kindId from prompt`);
  }
  session.log.debug(`kindId: ${kindId}`);

  let kind: SubmissionKindDTO | undefined;
  // retrieve the full kind DTO from the API
  try {
    kind = await getSubmissionKind(session, venue, kindId);
  } catch (err: any) {
    session.log.info(
      `${chalk.red(`🚨 could not get submission kind details "${kindId}" from venue ${venue}`)}`,
    );
    process.exit(1);
  }

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

/**
 * Prompt user for a new work key
 *
 * First, gives a simple Y/n with a default UUID. If the user is unhappy with that,
 * they are prompted to write their own key.
 *
 * This key cannot already exist as a work key; if you want to link to an existing
 * work, you must put the key directly in your project config file.
 */
export async function promptForNewKey(
  session: ISession,
  opts?: { yes?: boolean },
): Promise<string> {
  const defaultKey = uuid();
  if (opts?.yes) {
    session.log.debug(`Using autogenerated key: ${defaultKey}`);
    return defaultKey;
  }
  const { useDefault } = await inquirer.prompt([
    {
      name: 'useDefault',
      message: `Work key is required. Use autogenerated value? (${defaultKey})`,
      type: 'confirm',
      default: true,
    },
  ]);
  if (useDefault) return defaultKey;
  const { customKey } = await inquirer.prompt([
    {
      name: 'customKey',
      type: 'input',
      message: 'Enter a unique key for your work?',
      validate: async (key: string) => {
        if (key.length < 8) {
          return 'Key must be at least 8 characters';
        }
        if (key.length > 50) {
          return 'Key must be no more than 50 characters';
        }
        try {
          const { exists } = await getFromJournals(session, `works/key/${key}`);
          if (exists) return `Key "${key}" not available.`;
        } catch (err) {
          return 'Key validation failed';
        }
        return true;
      },
    },
  ]);
  return customKey;
}

export async function checkVenueExists(session: ISession, venue: string) {
  try {
    session.log.debug(`GET from journals API sites/${venue}`);
    await getFromJournals(session, `sites/${venue}`);
    session.log.debug(`found venue "${venue}"`);
  } catch (err) {
    session.log.debug(err);
    session.log.error(`${chalk.red(`😟 venue "${venue}" not found.`)}`);
    process.exit(1);
  }
}

export async function checkVenueAccess(session: ISession, venue: string) {
  try {
    const { submit } = (await getFromJournals(session, `sites/${venue}/access`)) as {
      read: boolean;
      submit: boolean;
    };
    if (submit) {
      const collections = (await getFromJournals(
        session,
        `sites/${venue}/collections`,
      )) as CollectionListingDTO;

      const openCollections = collections.items.filter((c) => c.open);

      if (openCollections.length === 0) {
        session.log.info(`${chalk.red(`🚦 venue "${venue}" is not accepting submissions.`)}`);
        process.exit(1);
      }

      if (openCollections.length > 1) {
        session.log.info(
          `${chalk.green(`💚 venue "${venue}" is accepting submissions in the following collections: ${openCollections.map((c) => collectionMoniker(c)).join(', ')}`)}`,
        );
      } else {
        session.log.info(
          `${chalk.green(`💚 venue "${venue}" is accepting submissions (${collectionMoniker(openCollections[0])}).`)}`,
        );
      }
      return collections;
    } else {
      session.log.debug('You do not have permission to submit to this venue.');
      throw new Error('You do not have permission to submit to this venue.');
    }
  } catch (err) {
    session.log.info(`${chalk.red(`🚦 venue "${venue}" is not accepting submissions.`)}`);
    process.exit(1);
  }
}

export async function checkForSubmissionKeyInUse(session: ISession, venue: string, key: string) {
  session.log.debug(`checking to see if submission key is in use: "${key}"`);
  try {
    const { exists } = (await getFromJournals(
      session,
      `sites/${venue}/submissions/key/${key}`,
    )) as { exists: boolean };
    return exists;
  } catch (err) {
    session.log.debug(err);
    return null;
  }
}

export async function chooseSubmission(
  session: ISession,
  submissions: SubmissionsListItemDTO[],
  opts?: { yes?: boolean },
): Promise<SubmissionsListItemDTO> {
  if (opts?.yes) {
    session.log.debug(`Updating latest submission`);
    return submissions[0];
  }
  const { useLatest } = await inquirer.prompt([
    {
      name: 'useLatest',
      message: `Update latest submission?`,
      type: 'confirm',
      default: true,
    },
  ]);
  if (useLatest) return submissions[0];
  throw new Error('Using non-latest submission not yet supported...');
}

export async function checkForSubmissionUsingKey(session: ISession, venue: string, key: string) {
  session.log.debug(`checking for existing submission using key "${key}"`);
  let submissions: SubmissionsListingDTO;
  try {
    submissions = await getFromJournals(session, `sites/${venue}/submissions?key=${key}`);
  } catch (err) {
    session.log.debug(err);
    return;
  }
  const draftSubmissions = submissions.items.filter((submission) => {
    return submission.status === 'DRAFT';
  });
  const nonDraftSubmissions = submissions.items.filter((submission) => {
    return submission.status !== 'DRAFT';
  });
  if (draftSubmissions.length > 0) {
    session.log.debug(`Ignoring ${plural('%s draft submission(s)', draftSubmissions)}`);
  }
  if (nonDraftSubmissions.length === 0) {
    session.log.debug('existing submission not found');
    return;
  }
  if (nonDraftSubmissions.length === 1) {
    session.log.debug(`${chalk.bold(`🔍 Found one existing submission`)}`);
    return nonDraftSubmissions[0];
  }
  session.log.info(
    `🔍 Found ${plural('%s existing submission(s)', nonDraftSubmissions)} for this work`,
  );
  const submission = await chooseSubmission(session, nonDraftSubmissions);
  return submission;
}

export async function confirmUpdateToExistingSubmission(
  session: ISession,
  venue: string,
  collections: CollectionListingDTO,
  submission: SubmissionsListItemDTO,
  key: string,
  opts?: SubmitOpts,
) {
  session.log.debug('found existing submission with work');
  const lastSubDate = submission.active_version.date_created;
  session.log.info(
    chalk.bold(
      `🗓  Work was last submitted to "${venue}" on ${
        lastSubDate ? format(new Date(lastSubDate), 'dd MMM, yyyy HH:mm:ss') : 'unknown'
      }.`,
    ),
  );

  try {
    session.log.debug('existing submission collection id', submission.collection?.id);
    const collection = collections.items.find((c) => c.id === submission.collection?.id);
    const openCollections = collections.items.filter((c) => c.open);

    if (
      opts?.collection &&
      // Cast may be removed with next @curvenote/common release
      opts.collection !== (submission.collection as SubmissionDTO['collection'])?.name
    ) {
      session.log.info(
        `🪧  NOTE: the --collection option was provided, but will be ignored as you are updating an existing submission`,
      );
    }

    session.log.info(
      `✅ Submission found, collection: ${
        collection ? collectionMoniker(collection) : 'unknown'
      }, ${plural('%s version(s)', submission.num_versions)} present, active status: ${
        submission.active_version.status
      }.`,
    );

    if (!collection?.open) {
      session.log.error(
        chalk.bold.red('⛔️ the collection for this submission is not accepting submissions'),
      );
      session.log.info(
        `${chalk.bold(`📚 open collections are: ${openCollections.map((c) => collectionMoniker(c)).join(', ')}`)}`,
      );
      process.exit(1);
    }

    const work = await getWorkFromKey(session, key);
    if (!work) {
      session.log.info(
        `${chalk.red(
          `🚨 the work related to your submission was not found, or you do not have permission to update it`,
        )}`,
      );
    }

    const kindId = submission.kind_id;
    if (opts?.kind && opts.kind !== submission?.kind) {
      session.log.info(
        `🪧  NOTE: the --kind option was provided, but will be ignored as you are updating an existing submission`,
      );
    }

    session.log.debug(`resolved kind to ${submission?.kind}`);
    const kind = await getSubmissionKind(session, venue, kindId);

    if (!collection.kinds.find((k) => k.id === kindId)) {
      session.log.error(
        `${chalk.red(`⛔️ the kind "${kind.name}" is not accepted in the collection "${collectionMoniker(collection)}". This indicates a problem with your previous submission, please contact support@curvenote.com.`)}`,
      );
      process.exit(1);
    }

    await confirmOrExit(
      `Update your submission to "${venue}" based on the contents of your local folder?`,
      opts,
    );

    return { kind, collection };
  } catch (err: any) {
    session.log.debug(err);
    session.log.info(
      `${chalk.red(`🚨 submission not found, or you do not have permission to update it`)}`,
    );
    process.exit(1);
  }
}

export async function createNewSubmission(
  session: ISession,
  logCollector: Record<string, any>,
  venue: string,
  collection: CollectionDTO,
  kind: SubmissionKindDTO,
  cdn: string,
  cdnKey: string,
  jobId: string,
  key: string,
  opts?: SubmitOpts,
) {
  const workResp = await getWorkFromKey(session, key);
  let work: { workId: string; workVersionId: string };
  if (workResp) {
    session.log.debug(`posting new work version...`);
    work = await postNewWorkVersion(session, workResp.links.self, cdnKey, cdn);
    session.log.debug(`new work posted with version id ${work.workVersionId}`);
  } else {
    session.log.debug(`posting new work...`);
    work = await postNewWork(session, cdnKey, cdn, key);
    session.log.debug(`new work posted with id ${work.workId}`);
  }
  const { workId, workVersionId } = work;

  session.log.debug(`posting new submission...`);
  const { submissionId, submissionVersionId } = await postNewSubmission(
    session,
    venue,
    collection.id,
    kind.id,
    workVersionId,
    opts?.draft ?? false,
    jobId,
  );

  session.log.debug(`new submission posted with id ${submissionId}`);

  if (opts?.draft) {
    session.log.info(`🚀 ${chalk.green(`Your draft was successfully submitted to "${venue}"`)}.`);
  } else {
    session.log.info(`🚀 ${chalk.green(`Your work was successfully submitted to "${venue}"`)}.`);
  }

  logCollector.workId = workId;
  logCollector.workVersionId = workVersionId;
  logCollector.submissionId = submissionId;
  logCollector.submissionVersionId = submissionVersionId;
}

export async function updateExistingSubmission(
  session: ISession,
  logCollector: Record<string, any>,
  venue: string,
  cdnKey: string,
  submission: SubmissionsListItemDTO,
  jobId: string,
) {
  session.log.debug(`existing submission - upload & post`);
  try {
    session.log.debug(`posting new work version...`);
    const { workId, workVersionId } = await postNewWorkVersion(
      session,
      (submission.links as any).work,
      cdnKey,
      session.PRIVATE_CDN,
    );
    session.log.debug(`work version posted with id ${workVersionId}`);

    session.log.debug(`posting new version to existing submission...`);
    const { submissionId, submissionVersionId } = await postUpdateSubmissionWorkVersion(
      session,
      venue,
      submission.links.self,
      workVersionId,
      jobId,
    );

    session.log.debug(`submission version posted with id ${submissionVersionId}`);

    session.log.info(
      `🚀 ${chalk.bold.green(`Your submission was successfully updated at "${venue}"`)}.`,
    );

    logCollector.workId = workId;
    logCollector.workVersionId = workVersionId;
    logCollector.submissionId = submissionId;
    logCollector.submissionVersionId = submissionVersionId;
  } catch (err: any) {
    session.log.error(err.message);
    throw new Error(`🚨 ${chalk.bold.red('Could not update your submission')}`);
  }
}
