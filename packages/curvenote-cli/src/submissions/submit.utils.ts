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
import type {
  CollectionDTO,
  CollectionsDTO,
  SubmissionDTO,
  SubmissionKindDTO,
  SubmissionKindsDTO,
  SubmissionsListItemDTO,
  SubmissionsListingDTO,
} from '@curvenote/common';

export type SubmitOpts = {
  kind?: string;
  collection?: string;
  yes?: boolean;
  info: boolean;
  draft?: boolean;
  key?: string;
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
  const slug = collection.slug === '' ? 'default' : collection.slug;
  return `${collection.content.title} (${slug})` ?? slug;
}

export function collectionQuestions(venue: string, collections: CollectionsDTO['items']) {
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
  collections: CollectionsDTO,
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
    ? openCollections.find(
        (c) => c.slug === (opts?.collection === 'default' ? '' : opts?.collection),
      )
    : undefined;

  if (opts?.collection && (!selectedCollection || !selectedCollection?.open)) {
    session.log.info(
      `${chalk.red(`⛔️ collection "${opts?.collection}" is not open for submissions at venue "${venue}"`)}`,
    );
    session.log.info(
      `${chalk.bold(`🗂 open collections are: ${openCollections.map((c) => collectionMoniker(c)).join(', ')}`)}`,
    );
    process.exit(1);
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
): Promise<SubmissionKindsDTO> {
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
      )) as CollectionsDTO;

      const openCollections = collections.items.filter((c) => c.open);

      if (openCollections.length === 0) {
        session.log.info(`${chalk.red(`🚦 venue "${venue}" is not accepting submissions.`)}`);
        process.exit(1);
      }

      if (openCollections.length > 1) {
        session.log.info(
          `${chalk.green(`💚 venue "${venue}" is accepting submissions in the following collections: ${openCollections.map((c) => c.content.title ?? c.slug).join(', ')}`)}`,
        );
      } else {
        session.log.info(
          `${chalk.green(`💚 venue "${venue}" is accepting submissions (${openCollections[0].content.title ?? openCollections[0].content.slug}).`)}`,
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

export async function checkForSubmissionUsingKey(session: ISession, venue: string, key: string) {
  session.log.debug(`checking for existing submission using key "${key}"`);
  try {
    const submissions = (await getFromJournals(
      session,
      `sites/${venue}/submissions?key=${key}`,
    )) as SubmissionsListingDTO;
    if (submissions.items.length === 0) throw new Error('submission not found');
    session.log.debug(`${chalk.bold(`🔍 Found an existing submission`)}`);
    return submissions.items[0] as SubmissionsListItemDTO;
  } catch (err) {
    session.log.debug(err);
    return null;
  }
}

export async function confirmUpdateToExistingSubmission(
  session: ISession,
  venue: string,
  collections: CollectionsDTO,
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

  try {
    session.log.debug(
      `GET from journals API sites/${venue}/submissions/${venueTransferData.submission?.id}`,
    );
    const existingSubmission = (await getFromJournals(
      session,
      `sites/${venue}/submissions/${venueTransferData.submission?.id}`,
    )) as SubmissionDTO;

    session.log.debug('existing submission collection id', existingSubmission.collection?.id);
    const collection = collections.items.find((c) => c.id === existingSubmission.collection?.id);
    const openCollections = collections.items.filter((c) => c.open);

    if (opts?.collection && opts.collection !== existingSubmission?.collection?.slug) {
      session.log.info(
        `🪧  NOTE: the --collection option was provided, but will be ignored as you are updating an existing submission`,
      );
    }

    session.log.info(
      `✅ Submission found, collection: ${collection ? collectionMoniker(collection) : 'unknown'}, ${existingSubmission?.versions.length} version${
        (existingSubmission?.versions ?? []).length > 1 ? 's' : ''
      } present, latest status: ${existingSubmission?.versions[0].status}.`,
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

    const kindId = existingSubmission.kind_id;
    if (opts?.kind && opts.kind !== existingSubmission?.kind) {
      session.log.info(
        `🪧  NOTE: the --kind option was provided, but will be ignored as you are updating an existing submission`,
      );
    }

    session.log.debug(`resolved kind to ${existingSubmission?.kind}`);
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
  key?: string,
  opts?: SubmitOpts,
) {
  session.log.debug(`posting new work...`);
  const { work, workVersion } = await postNewWork(session, cdnKey, cdn);
  session.log.debug(`work posted with id ${work.id}`);

  session.log.debug(`posting new submission...`);
  const { submission, submissionVersion } = await postNewSubmission(
    session,
    venue,
    collection.id,
    kind.id,
    workVersion.id,
    opts?.draft ?? false,
    jobId,
    key,
  );

  session.log.debug(`new submission posted with id ${submission.id}`);

  if (opts?.draft) {
    session.log.info(`🚀 ${chalk.green(`Your draft was successfully submitted to "${venue}"`)}.`);
  } else {
    session.log.info(`🚀 ${chalk.green(`Your work was successfully submitted to "${venue}"`)}.`);
  }

  logCollector.work = work;
  logCollector.workVersion = workVersion;
  logCollector.submission = submission;
  logCollector.submissionVersion = submissionVersion;
}

export async function updateExistingSubmission(
  session: ISession,
  logCollector: Record<string, any>,
  venue: string,
  cdnKey: string,
  venueTransferData: TransferDataItem,
  jobId: string,
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
      jobId,
    );

    session.log.debug(`submission version posted with id ${submissionVersion.id}`);

    session.log.info(
      `🚀 ${chalk.bold.green(`Your submission was successfully updated at "${venue}"`)}.`,
    );

    logCollector.work = work;
    logCollector.workVersion = workVersion;
    logCollector.submission = submission;
    logCollector.submissionVersion = submissionVersion;
  } catch (err: any) {
    session.log.error(err.message);
    throw new Error(`🚨 ${chalk.bold.red('Could not update your submission')}`);
  }
}
