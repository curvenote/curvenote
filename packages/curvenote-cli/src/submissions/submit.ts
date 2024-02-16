import type { ISession } from '../session/types.js';
import { upwriteTransferFile } from './utils.transfer.js';
import { confirmOrExit, writeJsonLogs } from '../utils/utils.js';
import chalk from 'chalk';
import { postNewCliCheckJob, postNewSubmission, postNewWork } from './utils.js';
import { uploadContentAndDeployToPrivateCdn } from '../utils/web.js';
import {
  ensureVenue,
  getSiteConfig,
  checkVenueExists,
  checkVenueAccess,
  determineSubmissionKind,
  performCleanRebuild,
  confirmUpdateToExistingSubmission,
  updateExistingSubmission,
  getTransferData,
  createNewSubmission,
} from './submit.utils.js';
import type { SubmitOpts } from './submit.utils.js';
import { submissionRuleChecks } from '@curvenote/check-implementations';
import type { CompiledCheckResults } from '../check/index.js';
import { logCheckReport, runChecks } from '../check/index.js';
import path from 'node:path';
import fs from 'node:fs';
import { getChecksForSubmission } from './check.js';

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

  // TODO upload preflight checks
  // TODO check the venue allows for submissions & updates to the submission
  // TODO check user has permission to submit /  update a submission

  const siteConfig = getSiteConfig(session);
  const transferData = await getTransferData(session, opts);
  venue = await ensureVenue(session, venue);
  await checkVenueExists(session, venue);
  await checkVenueAccess(session, venue);

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
  // Create work and submission
  //
  if (transferData?.[venue] && !opts?.draft) {
    await updateExistingSubmission(session, submitLog, venue, cdnKey, transferData[venue]);
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
      await createNewSubmission(session, submitLog, venue, kind, cdnKey, opts);
    } catch (err: any) {
      session.log.info(`\n\n🚨 ${chalk.bold.red('Could not submit your work')}.`);
      session.log.info(`📣 ${chalk.bold(err.message)}.`);
      process.exit(1);
    }
  }

  session.log.debug(`generating a build artifact for the submission...`);

  const job = await postNewCliCheckJob(
    session,
    {
      journal: venue,
      source: {
        repo: opts?.repo,
        branch: opts?.branch,
        path: opts?.path,
        commit: opts?.commit,
      },
    },
    {
      submissionId: submitLog.submission.id,
      submissionVersionId: submitLog.submissionVersion.id,
      workId: submitLog.work.id,
      workVersionId: submitLog.workVersion.id,
      checks: { venue, kind, report },
    },
  );

  const buildUrl = `${session.JOURNALS_URL.replace('v1/', '')}build/${job.id}`;
  submitLog.venue = venue;
  submitLog.kind = kind;
  submitLog.report = report;
  submitLog.job = job;
  submitLog.buildUrl = buildUrl;
  session.log.info(chalk.bold.green(`🔗 build report url: ${buildUrl}`));

  if (!opts?.draft) {
    session.log.debug(`writing to transfer.yml...`);
    await upwriteTransferFile(session, venue, {
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
