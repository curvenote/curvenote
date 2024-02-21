import type { ISession } from '../session/types.js';
import { upwriteTransferFile } from './utils.transfer.js';
import { confirmOrExit, writeJsonLogs } from '../utils/utils.js';
import chalk from 'chalk';
import { postNewCliCheckJob, patchUpdateCliCheckJob } from './utils.js';
import {
  ensureVenue,
  checkVenueExists,
  checkVenueAccess,
  determineSubmissionKind,
  performCleanRebuild,
  confirmUpdateToExistingSubmission,
  updateExistingSubmission,
  getTransferData,
  createNewSubmission,
  checkForSubmissionUsingKey,
} from './submit.utils.js';
import type { SubmitOpts } from './submit.utils.js';
import { submissionRuleChecks } from '@curvenote/check-implementations';
import type { CompiledCheckResults } from '../check/index.js';
import { logCheckReport, runChecks } from '../check/index.js';
import path from 'node:path';
import fs from 'node:fs';
import { getChecksForSubmission } from './check.js';
import { getGitRepoInfo } from './utils.git.js';
import { uploadContentAndDeployToPrivateCdn } from '../index.js';

export async function submit(session: ISession, venue: string, opts?: SubmitOpts) {
  const submitLog: Record<string, any> = {
    input: {
      venue,
      opts,
    },
  };
  if (session.isAnon) {
    throw new Error(
      '⚠️ You must be authenticated for this command. Use `curvenote token set [token]`',
    );
  }

  if (opts?.key && opts?.key.length < 8 && opts?.key !== 'git') {
    session.log.error(
      `🚨 The key must be at least 8 characters long, please specify a longer key.`,
    );
    process.exit(1);
  }

  // TODO upload preflight checks
  // TODO check the venue allows for submissions & updates to the submission
  // TODO check user has permission to submit /  update a submission

  // const siteConfig = getSiteConfig(session);
  let transferData = await getTransferData(session, opts);
  venue = await ensureVenue(session, venue);
  await checkVenueExists(session, venue);
  await checkVenueAccess(session, venue);

  const gitInfo = await getGitRepoInfo();

  if (opts?.key === 'git' && gitInfo == null) {
    session.log.error(
      `🚨 You are trying to generate a key from git but you are not in a git repository, try specifying a persistent '--key' instead.`,
    );
    process.exit(1);
  }

  const key = opts?.key == 'git' ? gitInfo?.key : opts?.key;
  if (key) {
    session.log.info(`📍 Submitting using a key: ${chalk.bold(key)}`);
    if (transferData?.[venue]) {
      session.log.warn(
        `🙈 The details in your existing transfer.yml file will not be used but will be overwritten with new details.`,
      );
      transferData = {};
    }
    const existing = await checkForSubmissionUsingKey(session, venue, key);
    if (existing) {
      session.log.info(
        `🔍 Found an existing submission using this key, the existing submission will be updated.`,
      );

      // TODO remove casts once common is published
      const sv = (existing as any).active_version as {
        id: string;
        date_created: string;
        status: string;
        submitted_by: {
          id: string;
          name: string;
        };
        work_id: string;
        work_version_id: string;
      };

      transferData = {
        ...transferData,
        [venue]: {
          work: {
            id: sv.work_id,
            date_created: sv.date_created,
          },
          workVersion: {
            id: sv.work_version_id,
            date_created: sv.date_created,
          },
          submission: { id: existing.id, date_created: existing.date_created },
          submissionVersion: { id: sv.id, date_created: sv.date_created },
        },
      };
    }
  }

  //
  // Options, checks and prompts
  //
  let kind: string | undefined;
  if (transferData?.[venue] && !opts?.draft) {
    kind = await confirmUpdateToExistingSubmission(session, venue, transferData[venue], opts);
  } else {
    //
    // NEW SUBMISSIONS
    //
    session.log.debug('new submission');
    kind = await determineSubmissionKind(session, venue, opts);

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

  const checks = await getChecksForSubmission(session, venue, kind);
  //
  // Process local folder and upload stuff
  //
  await performCleanRebuild(session, opts);
  session.log.info('🪩 Successfully built your work!');

  //
  // run checks
  //
  let report: CompiledCheckResults | undefined;
  if (checks && checks.length > 0) {
    session.log.info(`🕵️‍♀️ running checks...`);
    report = await runChecks(
      session,
      checks.map((c) => ({ id: c.id })),
      submissionRuleChecks,
    );
    const reportFilename = path.join(session.buildPath(), 'site', 'checks.json');
    session.log.debug(`💼 adding check report to ${reportFilename} for upload...`);
    fs.writeFileSync(reportFilename, JSON.stringify({ venue, kind, report }, null, 2));
    logCheckReport(session, report, false);
    session.log.info(`🏁 checks completed`);
  }

  // const cdnKey = 'ad7fa60f-5460-4bf9-96ea-59be87944e41'; // dev debug
  const cdnKey = await uploadContentAndDeployToPrivateCdn(session, {
    ...opts,
    ci: opts?.yes,
  });
  session.log.info(`🚀 ${chalk.bold.green(`Content uploaded with key ${cdnKey}`)}.`);

  //
  // Create a job to track the build and checks
  //
  const source = {
    repo: gitInfo?.repo,
    branch: gitInfo?.branch,
    path: gitInfo?.path,
    commit: gitInfo?.commit,
  };

  const job = await postNewCliCheckJob(
    session,
    {
      site: venue,
      source,
      key,
    },
    { checks: { venue, kind, report } },
  );
  const buildUrl = `${session.JOURNALS_URL.replace('v1/', '')}build/${job.id}`;
  session.log.info(`🤖 created a job to track this build: ${buildUrl}`);

  process.on('exit', async (exitCode: number) => {
    // TODO https://stackoverflow.com/questions/40574218/how-to-perform-an-async-operation-on-exit
    if (exitCode === 0) return;
    await patchUpdateCliCheckJob(session, job.id, 'FAILED', 'Submission from CLI failed', {});
  });

  //
  // Create work and submission
  //
  if (transferData?.[venue] && !opts?.draft) {
    await updateExistingSubmission(session, submitLog, venue, cdnKey, transferData[venue], job.id);
  } else {
    if (opts?.draft) {
      session.log.info(
        `${chalk.bold(
          `🖐 Making a draft submission, existing transfer.yml files will be ignored.`,
        )}`,
      );
    } else {
      session.log.info(`✨ making a new submission`);
    }
    try {
      if (!kind) {
        session.log.error('🚨 No submission kind found.');
        process.exit(1);
      }
      await createNewSubmission(session, submitLog, venue, kind, cdnKey, job.id, key, opts);
    } catch (err: any) {
      session.log.info(`\n\n🚨 ${chalk.bold.red('Could not submit your work')}.`);
      session.log.info(`📣 ${chalk.bold(err.message)}.`);
      process.exit(1);
    }
  }

  session.log.debug(`generating a build artifact for the submission...`);

  await patchUpdateCliCheckJob(session, job.id, 'COMPLETED', 'Submission completed', {
    submissionId: submitLog.submission.id,
    submissionVersionId: submitLog.submissionVersion.id,
    workId: submitLog.work.id,
    workVersionId: submitLog.workVersion.id,
    // checks: { venue, kind, report },
  });

  submitLog.key = key;
  submitLog.venue = venue;
  submitLog.kind = kind;
  submitLog.source = source;
  submitLog.report = report;
  submitLog.job = job;
  submitLog.buildUrl = buildUrl;
  session.log.info(chalk.bold.green(`🔗 build report url: ${buildUrl}`));

  if (!opts?.draft) {
    session.log.debug(`writing to transfer.yml...`);
    await upwriteTransferFile(session, venue, {
      key,
      work: submitLog.work,
      workVersion: submitLog.workVersion,
      submission: submitLog.submission,
      submissionVersion: submitLog.submissionVersion,
    });
    session.log.info(
      `The "./transfer.yml" file has been updated your submission information, please keep this file or commit this change.`,
    );
  }

  writeJsonLogs(session, 'curvenote.submit.json', submitLog);
}
