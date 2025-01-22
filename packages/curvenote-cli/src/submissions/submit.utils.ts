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
import { addOxaTransformersToOpts, confirmOrExit } from '../utils/utils.js';
import chalk from 'chalk';
import { format } from 'date-fns';
import {
  getFromJournals,
  getFromUrl,
  postNewSubmission,
  postNewWork,
  postNewWorkVersion,
  postUpdateSubmissionWorkVersion,
} from './utils.js';
import inquirer from 'inquirer';
import type {
  CollectionDTO,
  CollectionListingDTO,
  SubmissionKindDTO,
  SubmissionsListItemDTO,
  SubmissionsListingDTO,
  WorkDTO,
} from '@curvenote/common';
import { plural } from 'myst-common';
import { getWorkFromKey } from '../works/utils.js';
import type { SubmitLog, SubmitOpts } from './types.js';

export function kindQuestions(
  kinds: Omit<SubmissionKindDTO, 'date_created' | 'date_modified' | 'checks'>[],
) {
  return {
    name: 'kinds',
    type: 'list',
    message: 'What kind of submission are you making?',
    choices: kinds.map(({ name, id }) => ({ name, value: id })),
  };
}

export function collectionMoniker(collection: CollectionDTO) {
  if (collection.name === collection.content.title) {
    return collection.name;
  }
  return `${collection.content.title} (${collection.name})` ?? collection.name;
}

export function collectionQuestions(
  venue: string,
  collections: CollectionListingDTO['items'],
  opts?: { allowClosedCollection?: boolean },
) {
  return {
    name: 'collections',
    type: 'list',
    message: `Venue ${venue} has multiple collections${
      opts?.allowClosedCollection ? '' : ' open for submission'
    }. Which do you want to select?`,
    choices: collections.map((item) => ({
      name: collectionMoniker(item),
      value: item,
    })),
  };
}

export function venueQuestion(session: ISession, action = 'submit') {
  return {
    name: 'venue',
    type: 'input',
    message: `Enter the venue name you want to ${action} to?`,
    filter: (venue: string) => venue.toLowerCase(),
    validate: async (venue: string) => {
      if (venue.length < 3) {
        return 'Venue name must be at least 3 characters';
      }
      try {
        await getFromJournals(session, `/sites/${venue}`);
      } catch (err) {
        return `Venue "${venue}" not found.`;
      }
      return true;
    },
  };
}

/**
 * Choose and return a collection and kind based on venue
 *
 * By default, this function only looks at open collections; however, if
 * `opts.allowClosedCollection` is `true`, the "open" requirement is removed.
 *
 * First `collection` must be determined; successful cases include:
 * - `collection` is provided, valid, and "open"
 * - `venue` has a single, "open" `collection`
 * - `opts.yes` is `true` and the `venue` has a default, "open" `collection`
 * - user interactively selects one of the available `collections` on the `venue`
 *
 * On failure, this function will `process.exit(1)`. Failure cases include:
 * - No "open" collections
 * - Provided `collection` is invalid or not "open"
 * - `opts.yes` is `true` but there is no default, "open" `collection`
 *
 * After determining `collection`, `kind` is chosen using `determineKindFromCollection`.
 */
export async function determineCollectionAndKind(
  session: ISession,
  venue: string,
  collections: CollectionListingDTO,
  opts?: { kind?: string; collection?: string; yes?: boolean; allowClosedCollection?: boolean },
): Promise<{ collection: CollectionDTO; kind: SubmissionKindDTO; prompted?: boolean }> {
  const openCollections = [
    ...collections.items.filter((c) => c.open && c.default),
    ...collections.items.filter((c) => c.open && !c.default),
  ];
  if (!opts?.allowClosedCollection && openCollections.length === 0) {
    session.log.info(
      `${chalk.red(`⛔️ no collections are open for submissions at venue "${venue}"`)}`,
    );
    process.exit(1);
  }

  if (opts?.collection) session.log.debug(`Explicit collection provided: ${opts?.collection}`);
  let selectedCollection = opts?.collection
    ? collections.items.find((c) => c.name === opts?.collection)
    : undefined;

  if (opts?.collection) {
    if (!selectedCollection) {
      session.log.info(
        `${chalk.bold.red(
          `⛔️ collection "${opts?.collection}" does not exist at venue "${venue}"`,
        )}`,
      );
      session.log.info(
        `${chalk.bold(
          `🗂  open collections are: ${openCollections.map((c) => collectionMoniker(c)).join(', ')}`,
        )}`,
      );
      process.exit(1);
    }

    if (selectedCollection && !selectedCollection?.open) {
      session.log.info(
        `${chalk.bold.red(
          `⛔️ collection "${opts?.collection}" is not open for submissions at venue "${venue}"`,
        )}`,
      );
      if (!opts?.allowClosedCollection) {
        session.log.info(
          `${chalk.bold(
            `🗂  open collections are: ${openCollections
              .map((c) => collectionMoniker(c))
              .join(', ')}`,
          )}`,
        );
        process.exit(1);
      }
    }
  }
  let prompted = false;
  if (!selectedCollection) {
    const defaultCollection = collections.items.find((c) => c.default);
    if (defaultCollection && !defaultCollection.open) {
      session.log.info(
        `${chalk.red(
          `🗂  default collection "${defaultCollection.name}" is not open for submissions at venue "${venue}"`,
        )}`,
      );
    }
    if (!opts?.allowClosedCollection && openCollections.length === 1) {
      selectedCollection = openCollections[0];
    } else if (opts?.allowClosedCollection && collections.items.length === 1) {
      selectedCollection = collections.items[0];
    } else if (
      opts?.yes &&
      defaultCollection &&
      (defaultCollection.open || opts?.allowClosedCollection)
    ) {
      selectedCollection = defaultCollection;
    } else if (opts?.yes) {
      session.log.info(`${chalk.red(`⛔️ collection must be specified to continue submission`)}`);
      process.exit(1);
    } else {
      const response = await inquirer.prompt([
        collectionQuestions(
          venue,
          opts?.allowClosedCollection ? collections.items : openCollections,
          opts,
        ),
      ]);
      selectedCollection = response.collections as CollectionDTO;
      prompted = true;
    }
  }
  session.log.info(`🗂  Collection ${collectionMoniker(selectedCollection)} selected`);

  const results = await determineKindFromCollection(session, venue, selectedCollection, opts);

  return {
    collection: selectedCollection,
    kind: results.kind,
    prompted: results.prompted || prompted,
  };
}

/**
 * Fetch a list of kinds from `venue` API
 */
export async function listSubmissionKinds(
  session: ISession,
  venue: string,
): Promise<{ items: SubmissionKindDTO[] }> {
  return getFromJournals(session, `/sites/${venue}/kinds`);
}

/**
 * Fetch a single `venue` kind from API
 */
export async function getSubmissionKind(
  session: ISession,
  venue: string,
  kindIdOrName: string,
): Promise<SubmissionKindDTO> {
  return getFromJournals(session, `/sites/${venue}/kinds/${kindIdOrName}`);
}

/**
 * Choose and return one kind based on venue and collection
 *
 * Successful cases include:
 * - `kind` is provided and available on the `collection`
 * - `collection` with a single `kind`, which is returned
 * - `opts.yes` is `true` and the `collection` has a default `kind`, which is returned
 * - user interactively selects one of the available `kinds` on the `collection`
 *
 * On failure, this function will `process.exit(1)`. Failure cases include:
 * - Invalid `kind` is provided
 * - `opts.yes` is `true` but there is no default `kind`
 * - API fetch for selected kind fails (user is not authorized, venue does not exist, etc)
 */
export async function determineKindFromCollection(
  session: ISession,
  venue: string,
  collection: CollectionDTO,
  opts?: { kind?: string; yes?: boolean },
): Promise<{ kind: SubmissionKindDTO; prompted?: boolean }> {
  const kinds = collection.kinds;

  let kindId: string;
  let prompted = false;
  if (opts?.kind) {
    const match = kinds.find(
      ({ name }: { name: string }) => name.toLowerCase() === opts.kind?.toLowerCase(),
    );
    if (!match) {
      session.log.info(
        `${chalk.bold.red(
          `⛔️ submission kind "${
            opts.kind
          }" is not accepted in the collection "${collectionMoniker(collection)}"`,
        )}`,
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
  } else if (opts?.yes) {
    const defaultKind = kinds.find((k) => k.default);
    if (defaultKind) {
      session.log.debug(`kindId from default kind`);
      kindId = defaultKind.id;
    } else {
      session.log.info(`${chalk.red(`⛔️ kind must be specified to continue submission`)}`);
      process.exit(1);
    }
  } else {
    const response = await inquirer.prompt([kindQuestions(kinds)]);
    kindId = response.kinds;
    prompted = true;
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

  return { kind, prompted };
}

export function getSiteConfig(session: ISession) {
  const siteConfig = selectors.selectCurrentSiteConfig(session.store.getState());
  if (!siteConfig) {
    throw new Error('🧐 No site config found.');
  }
  return siteConfig;
}

export async function ensureVenue(
  session: ISession,
  venue: string | undefined,
  opts: { yes?: boolean; action?: string } = { action: 'submit' },
) {
  if (venue) return venue;
  if (opts?.yes) {
    throw new Error(`⛔️ venue must be specified to continue submission`);
  }
  session.log.debug('No venue provided, prompting user...');
  const answer = await inquirer.prompt([venueQuestion(session, opts.action)]);
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
          const { exists } = await getFromJournals(session, `/works/key/${key}`);
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

/**
 * Ensure that a `venue` exists by performing a basic request to the venue
 *
 * If venue does not exist, fails with `process.exit(1)`.
 */
export async function checkVenueExists(session: ISession, venue: string) {
  try {
    session.log.debug(`GET from journals API /sites/${venue}`);
    await getFromJournals(session, `/sites/${venue}`);
    session.log.debug(`found venue "${venue}"`);
  } catch (err) {
    session.log.debug(err);
    session.log.error(`${chalk.red(`😟 venue "${venue}" not found.`)}`);
    process.exit(1);
  }
}

export async function checkVenueSubmitAccess(session: ISession, venue: string) {
  try {
    session.log.debug('checking submit access');
    const { submit } = (await getFromJournals(session, `/sites/${venue}/access`)) as {
      read: boolean;
      submit: boolean;
    };
    session.log.debug('checking submit access - GET successful', submit);
    if (submit) return true;
    session.log.debug('You do not have permission to submit to this venue.');
    throw new Error('You do not have permission to submit to this venue.');
  } catch (err) {
    session.log.info(`${chalk.red(`🚦 venue "${venue}" is not accepting submissions.`)}`);
    process.exit(1);
  }
}

/**
 * Fetch `venue` collections from API
 */
export async function listCollections(
  session: ISession,
  venue: string,
): Promise<CollectionListingDTO> {
  return getFromJournals(session, `/sites/${venue}/collections`);
}

/**
 * Get collections from `venue` and log information about open collections
 *
 * This will fail with `process.exit(1)` if the fetch for venue collections fails.
 * By default, it also fails if there are no open collections.
 *
 * If `requireOpenCollections` is false, this function will not fail if there are
 * only closed collections or no collections at all.
 */
export async function getVenueCollections(
  session: ISession,
  venue: string,
  requireOpenCollections = true,
) {
  let collections: CollectionListingDTO;
  try {
    collections = await listCollections(session, venue);
  } catch (err) {
    session.log.info(
      `${chalk.red(
        `🚦 venue "${venue}" is unavailable; make sure the name is correct and you have permission to access`,
      )}`,
    );
    process.exit(1);
  }

  const openCollections = collections.items.filter((c) => c.open);

  if (openCollections.length === 0) {
    session.log.info(`${chalk.red(`🚦 venue "${venue}" is not accepting submissions.`)}`);
    if (requireOpenCollections) process.exit(1);
  } else if (openCollections.length > 1) {
    session.log.info(
      `${chalk.green(
        `💚 venue "${venue}" is accepting submissions in the following collections: ${openCollections
          .map((c) => collectionMoniker(c))
          .join(', ')}`,
      )}`,
    );
  } else {
    session.log.info(
      `${chalk.green(
        `💚 venue "${venue}" is accepting submissions (${collectionMoniker(openCollections[0])}).`,
      )}`,
    );
  }
  return collections;
}

export async function checkForSubmissionKeyInUse(session: ISession, venue: string, key: string) {
  session.log.debug(`checking to see if submission key is in use: "${key}"`);
  try {
    const { exists } = (await getFromJournals(
      session,
      `/sites/${venue}/submissions/key/${key}`,
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

export async function getAllSubmissionsUsingKey(
  session: ISession,
  venue: string,
  key: string,
): Promise<SubmissionsListItemDTO[] | undefined> {
  session.log.debug(`checking for existing submission using key "${key}"`);
  let submissions: SubmissionsListingDTO;
  try {
    submissions = await getFromJournals(session, `/sites/${venue}/submissions?key=${key}`);
  } catch (err) {
    session.log.debug(err);
    return;
  }
  return submissions.items;
}

export async function getSubmissionToUpdate(
  session: ISession,
  submissions: SubmissionsListItemDTO[],
) {
  const draftSubmissions = submissions.filter((submission) => {
    return submission.status === 'DRAFT';
  });
  const nonDraftSubmissions = submissions.filter((submission) => {
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

    if (opts?.collection && opts.collection !== submission.collection?.name) {
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
        chalk.bold.red('⛔️ The collection for this submission is not accepting submissions'),
      );
      session.log.info(
        `${chalk.bold(
          `📚 Open collections are: ${openCollections.map((c) => collectionMoniker(c)).join(', ')}`,
        )}`,
      );
      process.exit(1);
    }

    const work = await getWorkFromKey(session, key);
    if (!work) {
      session.log.info(
        `${chalk.yellow(
          '👉 You do not own the work associated with this submission, but you may still be able to update it',
        )}`,
      );
    }

    const kindId = (submission?.kind as any).id;
    const kindName = (submission?.kind as any).name ?? submission?.kind;
    if (opts?.kind && opts.kind !== kindName) {
      session.log.info(
        `🪧  NOTE: the --kind option was provided, but will be ignored as you are updating an existing submission`,
      );
    }

    session.log.debug(`resolved kind to ${kindName}`);
    const kind = await getSubmissionKind(session, venue, kindId);

    if (!collection.kinds.find((k) => k.id === kindId)) {
      session.log.error(
        `${chalk.red(
          `⛔️ The kind "${kind.name}" is not accepted in the collection "${collectionMoniker(
            collection,
          )}". This indicates a problem with your previous submission, please contact support@curvenote.com.`,
        )}`,
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
      `${chalk.red(`🚨 Submission not found, or you do not have permission to update it`)}`,
    );
    process.exit(1);
  }
}

export async function createNewSubmission(
  session: ISession,
  submitLog: SubmitLog,
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
  let work: WorkDTO;
  if (workResp) {
    session.log.debug(`posting new work version...`);
    work = await postNewWorkVersion(session, workResp.links.versions, cdnKey, cdn);
    session.log.debug(`new work posted with version id ${work.version_id}`);
  } else {
    session.log.debug(`posting new work...`);
    try {
      work = await postNewWork(session, cdnKey, cdn, key);
    } catch (err) {
      if (opts?.draft) {
        session.log.debug(
          `unable to create a work with key ${key} - attempting to create un-keyed work for draft submission`,
        );
        work = await postNewWork(session, cdnKey, cdn);
      } else {
        throw err;
      }
    }
    session.log.debug(`new work posted with id ${work.id}`);
  }
  if (!work.version_id) {
    throw new Error('Failed to create a work version');
  }
  session.log.debug(`posting new submission...`);
  const submission = await postNewSubmission(
    session,
    venue,
    collection.id,
    kind.id,
    work.version_id,
    opts?.draft ?? false,
    jobId,
  );

  session.log.debug(`new submission posted with id ${submission.id}`);

  if (opts?.draft) {
    session.log.info(`🚀 ${chalk.green(`Your draft was successfully submitted to "${venue}"`)}.`);
  } else {
    session.log.info(`🚀 ${chalk.green(`Your work was successfully submitted to "${venue}"`)}.`);
  }

  submitLog.work = {
    id: work.id,
    date_created: workResp?.date_created ?? work.date_created,
  };
  submitLog.workVersion = {
    id: work.version_id,
    date_created: work.date_created,
  };
  submitLog.submission = {
    id: submission.id,
    date_created: submission.date_created,
  };
  submitLog.submissionVersion = {
    id: submission.active_version_id,
    date_created: submission.date_created,
  };
}

export async function updateExistingSubmission(
  session: ISession,
  submitLog: SubmitLog,
  venue: string,
  cdnKey: string,
  existingSubmission: SubmissionsListItemDTO,
  jobId: string,
) {
  session.log.debug(`existing submission - upload & post`);
  try {
    if (!existingSubmission.links.work) {
      throw new Error('No work associated with existing submission');
    }
    session.log.debug(`getting existing work...`);
    const workResp = await getFromUrl(
      session,
      `${existingSubmission.links.work}?submission=${existingSubmission.id}`,
    );
    if (!workResp) {
      throw new Error('Unable to fetch work associated with existing submission');
    }
    session.log.debug(`posting new work version...`);
    const work = await postNewWorkVersion(
      session,
      workResp.links.versions,
      cdnKey,
      session.config.privateCdnUrl,
    );
    if (!work.version_id) {
      throw new Error('Failed to create a work version');
    }
    session.log.debug(`work version posted with id ${work.version_id}`);

    session.log.debug(`posting new version to existing submission...`);
    const submissionVersion = await postUpdateSubmissionWorkVersion(
      session,
      venue,
      existingSubmission.links.versions,
      work.version_id,
      jobId,
    );

    session.log.debug(`submission version posted with id ${submissionVersion.id}`);

    session.log.info(
      `🚀 ${chalk.bold.green(`Your submission was successfully updated at "${venue}"`)}.`,
    );

    submitLog.work = {
      id: work.id,
      date_created: workResp?.date_created ?? work.date_created,
    };
    submitLog.workVersion = {
      id: work.version_id,
      date_created: work.date_created,
    };
    submitLog.submission = {
      id: existingSubmission.id,
      date_created: existingSubmission.date_created,
    };
    submitLog.submissionVersion = {
      id: submissionVersion.id,
      date_created: submissionVersion.date_created,
    };
  } catch (err: any) {
    session.log.error(err.message);
    throw new Error(`🚨 ${chalk.bold.red('Could not update your submission')}`);
  }
}
