import type { ISession } from '../session/types.js';
import { keyFromTransferFile, writeKeyToConfig } from './utils.transfer.js';
import { confirmOrExit, writeJsonLogs, addOxaTransformersToOpts } from '../utils/utils.js';
import chalk from 'chalk';
import { postNewCliCheckJob, patchUpdateCliCheckJob, exitOnInvalidKeyOption } from './utils.js';
import {
  ensureVenue,
  checkVenueExists,
  confirmUpdateToExistingSubmission,
  updateExistingSubmission,
  createNewSubmission,
  checkForSubmissionKeyInUse,
  determineCollectionAndKind,
  collectionMoniker,
  promptForNewKey,
  getAllSubmissionsUsingKey,
  getSubmissionToUpdate,
  checkVenueSubmitAccess,
  getVenueCollections,
} from './submit.utils.js';
import { submissionRuleChecks } from '@curvenote/check-implementations';
import type { CompiledCheckResults } from '../check/index.js';
import { logCheckReport, runChecks } from '../check/index.js';
import path from 'node:path';
import fs from 'node:fs';
import { prepareChecksForSubmission } from './check.js';
import { getGitRepoInfo } from './utils.git.js';
import * as uploads from '../uploads/index.js';
import { workKeyFromConfig } from '../works/utils.js';
import type { CollectionDTO, SubmissionKindDTO, SubmissionsListItemDTO } from '@curvenote/common';
import type { GithubSource, SubmitLog, SubmitOpts } from './types.js';
import { buildSite, clean, collectAllBuildExportOptions, localArticleExport } from 'myst-cli';

export const CDN_KEY_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const DEV_CDN_KEY = 'ad7fa60f-5460-4bf9-96ea-59be87944e41';

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

export async function submit(session: ISession, venue: string, opts?: SubmitOpts) {
  const submitLog: SubmitLog = {
    input: {
      venue,
      opts,
    },
  };
  if (session.isAnon) {
    throw new Error(
      '⛔️ You must be authenticated for this command. Use `curvenote token set [token]`',
    );
  }

  // TODO upload preflight checks
  // TODO check the venue allows for submissions & updates to the submission
  // TODO check user has permission to submit /  update a submission

  venue = await ensureVenue(session, venue, opts);
  await checkVenueExists(session, venue);
  await checkVenueSubmitAccess(session, venue);
  const collections = await getVenueCollections(session, venue);

  let key = workKeyFromConfig(session);
  // Deprecation step to handle old transfer.yml files
  key = (await keyFromTransferFile(session, venue, key, opts)) ?? key;

  if (!key) {
    key = await promptForNewKey(session, opts);
    await writeKeyToConfig(session, key);
  }

  exitOnInvalidKeyOption(session, key);

  const gitInfo = await getGitRepoInfo();
  const source: GithubSource = {
    repo: gitInfo?.repo,
    branch: gitInfo?.branch,
    path: gitInfo?.path,
    commit: gitInfo?.commit,
  };

  session.log.info(`📍 Submitting using key: ${chalk.bold(key)}`);

  let existing: SubmissionsListItemDTO | undefined;
  // Only check for submissions to update if we are not creating a new draft
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

  //
  // Options, checks and prompts
  //
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
    );
    kind = confirmed.kind;
    collection = confirmed.collection;
  } else {
    //
    // NEW SUBMISSIONS
    //
    session.log.debug('Making a new submission...');
    const determined = await determineCollectionAndKind(session, venue, collections, opts);
    kind = determined.kind;
    collection = determined.collection;

    session.log.info(`📚 Submitting a "${kind?.name}" to the "${collectionMoniker(collection)}"`);

    if (opts?.draft)
      session.log.info(
        `📝 ${chalk.bold.yellow(
          `Making a draft submission, this will not be processed by "${venue}".`,
        )}`,
      );

    await confirmOrExit(
      opts?.draft
        ? `Submit your draft to "${venue}" based on the contents of your local folder?`
        : `Start a new submission to "${venue}" based on the contents of your local folder?`,
      opts,
    );
  }

  const checks = prepareChecksForSubmission(session, venue, kind);
  //
  // Process local folder and upload stuff
  //
  await performCleanRebuild(session, opts);
  session.log.info('🪩  Successfully built your work!');

  //
  // run checks
  //
  let report: CompiledCheckResults | undefined;
  if (checks && checks.length > 0) {
    session.log.info(`🕵️‍♀️  Running checks...`);
    report = await runChecks(session, checks, submissionRuleChecks);
    const reportFilename = path.join(session.buildPath(), 'site', 'checks.json');
    session.log.debug(`💼 adding check report to ${reportFilename} for upload...`);
    fs.writeFileSync(reportFilename, JSON.stringify({ venue, kind, report }, null, 2));
    logCheckReport(session, report, false);
    session.log.info(`🏁 Checks completed`);
  }

  if (!opts?.draft) {
    await confirmOrExit(
      checks
        ? `Build and submission checks completed, are you happy to proceed with submission to "${venue}"?`
        : `Build completed, are you happy to proceed with submission to "${venue}"?`,
      opts,
    );
  }

  //
  // Create a job to track the build and checks
  //
  session.log.info(`⛴  OK! Starting the submission process...`);
  let job = await postNewCliCheckJob(
    session,
    {
      site: venue,
      collection,
      kind,
      source,
      key,
    },
    {
      checks: {
        venue,
        kind,
        report,
      },
    },
  );

  try {
    job = await patchUpdateCliCheckJob(session, job.id, 'RUNNING', 'Uploading work files to cdn', {
      ...job.results,
    });

    const cdn = opts?.draft ? session.config.tempCdnUrl : session.config.privateCdnUrl;
    let cdnKey: string;
    if (!process.env.DEV_CDN || process.env.DEV_CDN === 'false') {
      const uploadResult = await uploads.uploadToCdn(session, cdn, opts);
      cdnKey = uploadResult.cdnKey;
    } else if (process.env.DEV_CDN.match(CDN_KEY_RE)) {
      cdnKey = process.env.DEV_CDN;
    } else {
      cdnKey = DEV_CDN_KEY;
    }
    session.log.info(`🚀 ${chalk.bold.green(`Content uploaded with key ${cdnKey}`)}.`);
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

    //
    // Create work and submission
    //
    if (existing) {
      await updateExistingSubmission(session, submitLog, venue, cdnKey, existing, job.id);
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
      // This is just a safety net - it will not be encountered unless we change
      // implementation of create/update submission functions or change the shape
      // of successful API responses.
      throw new Error(`work/submission ids not found from submission response`);
    }
    job = await patchUpdateCliCheckJob(session, job.id, 'COMPLETED', 'Submission completed', {
      ...job.results,
      submissionId: submitLog.submission?.id,
      submissionVersionId: submitLog.submissionVersion?.id,
      workId: submitLog.work?.id,
      workVersionId: submitLog.workVersion?.id,
    });

    submitLog.key = key;
    submitLog.venue = venue;
    submitLog.kind = kind;
    submitLog.source = source;
    submitLog.report = report;
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
