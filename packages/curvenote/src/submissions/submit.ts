import type { ISession } from '../session/types.js';
import { upwriteTransferFile } from './utils.transfer.js';
import { confirmOrExit } from '../utils/utils.js';
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
  celebrate,
  confirmUpdateToExistingSubmission,
  updateExistingSubmission,
  getTransferData,
} from './submit.utils.js';
import type { SubmitOpts } from './submit.utils.js';

export async function submit(session: ISession, venue: string, opts?: SubmitOpts) {
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

  //
  // Process local folder and upload stuff
  //
  await performCleanRebuild(session, opts);
  celebrate(session, 'Successfully built your work!');
  // const cdnKey = '96b95ed0-d19d-4c54-b5d9-d10fb7b3d9da'; // dev debug
  const cdnKey = await uploadContentAndDeployToPrivateCdn(session, {
    ...opts,
    ci: opts?.yes,
  });
  session.log.info(`🚀 ${chalk.bold.green(`Content uploaded with key ${cdnKey}`)}.`);

  //
  // Create work and submission
  //
  if (transferData?.[venue] && !opts?.draft) {
    await updateExistingSubmission(session, venue, cdnKey, transferData[venue]);
  } else {
    session.log.debug(`new submission - upload & post`);

    if (opts?.draft) {
      session.log.info(
        `📝 ${chalk.bold(
          `🖐 Making a draft submission, existing transfer.yml files will be ignored.`,
        )}`,
      );
    }
    session.log.debug(`posting new work...`);
    try {
      if (!kind) {
        session.log.error('🚨 No submission kind found.');
        process.exit(1);
      }

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
        session.log.info(
          `🚀 ${chalk.green(`Your draft was successfully submitted to "${venue}"`)}.`,
        );
      } else {
        session.log.info(
          `🚀 ${chalk.green(`Your work was successfully submitted to "${venue}"`)}.`,
        );
      }

      if (opts?.draft) {
        session.log.debug(`generating link for draft submision...`);

        const job = await postNewCliCheckJob(
          session,
          {
            journal: venue,
            source: {
              repo: opts.repo,
              branch: opts.branch,
              path: opts.path,
              commit: opts.commit,
            },
          },
          {
            submissionId: submission.id,
            submissionVersionId: submissionVersion.id,
          },
        );

        const buildUrl = `${session.JOURNALS_URL.replace('v1/', '')}build/${job.id}`;
        session.log.info(chalk.bold.green(`📒 access the build report and draft submission here:`));
        session.log.info(`\n\n\t${chalk.bold.green(`🔗 ${buildUrl} 🔗`)}\n\n`);
      } else {
        session.log.debug(`writing to transfer.yml...`);
        await upwriteTransferFile(session, venue, {
          work,
          workVersion,
          submission,
          submissionVersion,
        });
        session.log.info(
          `The "./transfer.yml" file has been updated your submission information, please keep this file or commit this change.`,
        );
      }
    } catch (err: any) {
      session.log.info(`\n\n🚨 ${chalk.bold.red('Could not submit your work')}.`);
      session.log.info(`📣 ${chalk.bold(err.message)}.`);
      process.exit(1);
    }
  }
}