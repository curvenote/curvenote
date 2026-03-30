import type { ISession } from '../session/types.js';
import { confirmOrExit, writeJsonLogs } from '../utils/utils.js';
import chalk from 'chalk';
import { selectors } from 'myst-cli';
import { uuidv7 } from 'uuidv7';
import { postNewCliCheckJob, patchUpdateCliCheckJob } from './utils.js';
import {
  confirmUpdateToExistingSubmission,
  updateExistingSubmission,
  createNewSubmission,
  checkForSubmissionKeyInUse,
  determineCollectionAndKind,
  collectionMoniker,
  getAllSubmissionsUsingKey,
  getSubmissionToUpdate,
  checkVenueSubmitAccess,
  getVenueCollections,
} from './submit.utils.js';
import {
  exitOnInvalidKeyOption,
  getWorkByCdnKey,
  getWorkFromKey,
  writeKeyToConfig,
} from '../works/utils.js';
import type { CollectionDTO, SubmissionKindDTO, SubmissionsListItemDTO } from '@curvenote/common';
import type { SubmitLog, SubmitOpts } from './types.js';
import { checkVenueExists, ensureVenue } from '../sites/utils.js';

const ATPROTO_CDN = 'atproto';

function logGeneratedWorkKeyBanner(session: ISession, key: string) {
  session.log.info('');
  session.log.info(
    chalk.bold.bgGreen.black(' NEW WORK KEY ') + '  ' + chalk.bold.whiteBright(key),
  );
  session.log.info('');
  session.log.info(
    chalk.dim(
      'A new Curvenote work will be created. To reuse this work on future submits, add under project: in myst.yml or curvenote.yml:',
    ),
  );
  session.log.info(chalk.cyan(`  id: ${key}`));
  session.log.info('');
}

/**
 * Submit by referencing AT Protocol content (at:// URI). Does not build, run checks,
 * read git/source logs, or upload to CDN; the work version uses cdn "atproto" and cdn_key = URI.
 */
export async function submitFromAtproto(session: ISession, venue: string, opts: SubmitOpts) {
  if (opts.skipRebuild) {
    throw new Error('--skip-rebuild cannot be used with --atproto');
  }
  const atUri = opts.atproto;
  if (!atUri) {
    throw new Error('Internal error: submitFromAtproto requires opts.atproto');
  }

  const submitLog: SubmitLog = {
    input: {
      venue,
      opts,
    },
  };

  venue = await ensureVenue(session, venue, opts);
  await checkVenueExists(session, venue);
  await checkVenueSubmitAccess(session, venue);
  const collections = await getVenueCollections(session, venue);

  const state = session.store.getState();
  const projectFile = selectors.selectCurrentProjectFile(state);

  let configKey: string | undefined;
  if (projectFile) {
    const projectConfig = selectors.selectCurrentProjectConfig(state);
    configKey = projectConfig?.id;
    session.log.debug(`Project config file: ${projectFile}`);
  } else {
    session.log.warn(
      chalk.yellow(
        'No myst.yml or curvenote.yml project file found for the current directory. A work key may be resolved from your AT URI or generated.',
      ),
    );
  }

  let key: string;
  let keyWasGenerated = false;
  let workForKey: Awaited<ReturnType<typeof getWorkFromKey>>;

  if (configKey) {
    session.log.info(
      `${chalk.bold('📌')} Work key from project config: ${chalk.bold.cyan(configKey)}.`,
    );
    workForKey = await getWorkFromKey(session, configKey);
    if (workForKey) {
      key = configKey;
    } else {
      const byCdn = await getWorkByCdnKey(session, atUri);
      if (byCdn?.key) {
        key = byCdn.key;
        workForKey = byCdn;
        session.log.info(
          `${chalk.bold('🔗')} Matched your AT Protocol URI to an existing work — using work key ${chalk.bold.cyan(key)}.`,
        );
        if (byCdn.key !== configKey) {
          session.log.warn(
            chalk.yellow(
              'Project id did not match a work on your account; the work linked to this AT URI is used for this submit.',
            ),
          );
        }
      } else {
        key = configKey;
        workForKey = undefined;
      }
    }
  } else {
    const byCdn = await getWorkByCdnKey(session, atUri);
    if (byCdn?.key) {
      key = byCdn.key;
      workForKey = byCdn;
      session.log.info(
        `${chalk.bold('🔗')} Resolved work key ${chalk.bold.cyan(key)} from your AT Protocol URI (no project id in config).`,
      );
      if (projectFile) {
        await writeKeyToConfig(session, key);
        session.log.info(chalk.bold.green(`✅ Saved work key to ${projectFile}`));
      }
    } else {
      key = uuidv7();
      keyWasGenerated = true;
      logGeneratedWorkKeyBanner(session, key);
      workForKey = undefined;
      if (projectFile) {
        await writeKeyToConfig(session, key);
        session.log.info(chalk.bold.green(`✅ Saved work key to ${projectFile}`));
      } else {
        session.log.warn(
          chalk.yellow(
            'No project config file to write to; this key applies to this submit only unless you add it to a myst.yml / curvenote.yml (see curvenote init).',
          ),
        );
      }
    }
  }

  exitOnInvalidKeyOption(session, key);
  submitLog.key = key;

  if (workForKey === undefined) {
    workForKey = await getWorkFromKey(session, key);
  }

  if (workForKey) {
    session.log.info(
      `${chalk.bold('📎')} A work already exists for this key — Curvenote will add a ${chalk.bold(
        'new work version',
      )} pointing at your AT Protocol URI.`,
    );
  } else {
    session.log.info(
      `${chalk.bold('✨')} No work exists yet for this key — Curvenote will ${chalk.bold(
        'create a new work',
      )}${keyWasGenerated ? '' : ' (first time using this key)'}.`,
    );
  }

  let existing: SubmissionsListItemDTO | undefined;
  if (!opts?.draft && !opts?.new) {
    session.log.info(`📡 Checking submission status...`);
    const allExisting = await getAllSubmissionsUsingKey(session, venue, key);
    if (!allExisting?.length) {
      const exists = await checkForSubmissionKeyInUse(session, venue, key);
      if (exists) {
        session.log.warn(
          `⛔️ This work has already been submitted to a Curvenote site, but you don't have permission to access that submission.`,
        );
        session.log.info(
          'If you still want to make a new submission, you may explicitly add flag "--new"',
        );
        process.exit(1);
      } else {
        session.log.info(`🔍 No existing submission found at "${venue}" using the key "${key}"`);
      }
    } else {
      existing = await getSubmissionToUpdate(session, allExisting);
      session.log.info(
        `🔍 Found an existing submission using this key, the existing submission will be updated.`,
      );
    }
  }

  let kind: SubmissionKindDTO | undefined;
  let collection: CollectionDTO | undefined;
  if (existing) {
    const confirmed = await confirmUpdateToExistingSubmission(
      session,
      venue,
      collections,
      existing,
      key,
      opts,
      `Update your submission to "${venue}" using AT Protocol URI ${atUri}?`,
    );
    kind = confirmed.kind;
    collection = confirmed.collection;
  } else {
    session.log.debug('Making a new submission (AT Protocol)...');
    const determined = await determineCollectionAndKind(session, venue, collections, opts);
    kind = determined.kind;
    collection = determined.collection;

    session.log.info(`📚 Submitting a "${kind?.name}" to the "${collectionMoniker(collection)}"`);

    if (opts?.draft) {
      session.log.info(
        `📝 ${chalk.bold.yellow(
          `Making a draft submission, this will not be processed by "${venue}".`,
        )}`,
      );
    }

    await confirmOrExit(
      opts?.draft
        ? `Submit your draft to "${venue}" referencing ${atUri}?`
        : `Start a new submission to "${venue}" referencing ${atUri}?`,
      opts,
    );
  }

  if (!opts?.draft) {
    await confirmOrExit(
      `Proceed with submission to "${venue}" using AT Protocol content at ${atUri}?`,
      opts,
    );
  }

  if (!kind || !collection) {
    session.log.error('🚨 No submission kind or collection found.');
    process.exit(1);
  }

  session.log.info(`⛴  OK! Starting the submission process...`);
  let job = await postNewCliCheckJob(
    session,
    {
      site: venue,
      collection,
      kind,
      source: {},
      key,
    },
    {
      checks: {
        venue,
        kind,
      },
    },
  );

  try {
    job = await patchUpdateCliCheckJob(session, job.id, 'RUNNING', 'Linking AT Protocol URI', {
      ...job.results,
    });

    const cdn = ATPROTO_CDN;
    const cdnKey = atUri;
    session.log.info(`🚀 ${chalk.bold.green(`Using AT Protocol URI as work content: ${cdnKey}`)}.`);
    job = await patchUpdateCliCheckJob(
      session,
      job.id,
      'RUNNING',
      'Creating new work and submission entry',
      {
        ...job.results,
        cdnKey,
      },
    );

    const buildUrl = `${session.config.adminUrl}/build/${job.id}`;
    session.log.info(`🤖 created a job to track this build: ${buildUrl}`);

    if (existing) {
      await updateExistingSubmission(session, submitLog, venue, cdn, cdnKey, existing, job.id);
    } else {
      if (opts?.draft) {
        session.log.info(`${chalk.bold(`🖐  Making a draft submission`)}`);
      } else {
        session.log.info(`✨ Making a new submission`);
      }
      if (!kind) {
        session.log.error('🚨 No submission kind found.');
        process.exit(1);
      }
      await createNewSubmission(
        session,
        submitLog,
        venue,
        collection,
        kind,
        cdn,
        cdnKey,
        job.id,
        key,
        opts,
      );
    }
    session.log.debug(`generating a build artifact for the submission...`);

    if (
      !submitLog.work?.id ||
      !submitLog.workVersion?.id ||
      !submitLog.submission?.id ||
      !submitLog.submissionVersion?.id
    ) {
      throw new Error(`work/submission ids not found from submission response`);
    }
    job = await patchUpdateCliCheckJob(session, job.id, 'COMPLETED', 'Submission completed', {
      ...job.results,
      submissionId: submitLog.submission?.id,
      submissionVersionId: submitLog.submissionVersion?.id,
      workId: submitLog.work?.id,
      workVersionId: submitLog.workVersion?.id,
    });

    submitLog.venue = venue;
    submitLog.kind = kind;
    submitLog.job = job;
    submitLog.buildUrl = buildUrl;
    session.log.info(chalk.bold.green(`🔗 build report url: ${buildUrl}`));
    writeJsonLogs(session, 'curvenote.submit.json', submitLog);
  } catch (err: any) {
    await patchUpdateCliCheckJob(session, job.id, 'FAILED', 'Submission from CLI failed', {
      ...job.results,
      error: err.message,
    });
    session.log.error(`📣 ${chalk.bold.red(err.message)}`);
    session.log.info('📨 Please contact support@curvenote.com');
    writeJsonLogs(session, 'curvenote.submit.json', submitLog);
    process.exit(1);
  }
}
