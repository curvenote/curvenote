import chalk from 'chalk';
import Table from 'cli-table3';
import type { ISession } from '../session/types.js';
import { formatDate, getFromJournals } from './utils.js';
import type { MySubmissionsListingDTO, SubmissionsListItemDTO } from '@curvenote/common';

function logSubmissionItem(session: ISession, submission: SubmissionsListItemDTO) {
  const table = new Table({
    chars: {
      top: '',
      'top-mid': '',
      'top-left': '',
      'top-right': '',
      bottom: '',
      'bottom-mid': '',
      'bottom-left': '',
      'bottom-right': '',
      left: '',
      'left-mid': '',
      mid: '',
      'mid-mid': '',
      right: '',
      'right-mid': '',
      middle: '  ',
    },
    style: { 'padding-left': 0, 'padding-right': 0 },
  });

  session.log.info(`\n\n${chalk.bold.cyan(submission.title)}`);
  session.log.info(
    chalk.bold(
      `Submitted as a ${chalk.green(submission.kind)} to ${chalk.green(
        submission.site_name,
      )} on ${chalk.green(formatDate(submission.date_created))}`,
    ),
  );
  if (submission.description) session.log.info(chalk.grey(submission.description));
  if (submission.authors)
    session.log.info(`Authors: ${chalk.grey(submission.authors.map((a) => a.name).join(', '))}`);

  table.push(
    ['Submission Date', formatDate(submission.date_created)],
    ['Published?', (submission as any).published ? 'Yes' : 'No'],
  );

  if ((submission as any).published) {
    table.push(
      ['Publication Date', formatDate((submission as any).date)],
      ['Published Version Date', (submission as any).published_version_date],
    );
  }

  table.push(
    [chalk.grey('Latest Version Status'), chalk.grey((submission as any).latest_status)],
    [chalk.grey('Num Versions'), chalk.grey((submission as any).num_versions)],
  );

  if (submission.last_activity)
    table.push([
      chalk.grey('Date of last activity'),
      chalk.grey(formatDate(submission.last_activity.date)),
    ]);

  session.log.info(table.toString());
}

export async function list(session: ISession, opts: { venue?: string }) {
  if (session.isAnon) {
    throw new Error(
      '⚠️ You must be authenticated for this command. Use `curvenote token set [token]`',
    );
  }

  const { venue } = opts;

  session.log.info(chalk.bold(`📡 Checking your submissions...`));

  const submissions = (await getFromJournals(
    session,
    `my/submissions/`,
  )) as MySubmissionsListingDTO;
  if (!submissions.items.length) {
    session.log.info(`🫙 You have no submissions.`);
    return;
  }

  if (opts?.venue) {
    try {
      await getFromJournals(session, `sites/${venue}`);
      // TODO check if submissions are allowed from this user
    } catch (err) {
      session.log.error(`${chalk.bold.red(`🤕 venue "${venue}" not found.`)}`);
      process.exit(1);
    }
    submissions.items = submissions.items.filter((s) => s.site_name === venue);
    session.log.info(`📥 You have made ${submissions.items.length} submissions to "${venue}".`);
  } else {
    session.log.info(`📥 You have ${submissions.items.length} submissions.`);
  }

  submissions.items.forEach((item: SubmissionsListItemDTO) => {
    logSubmissionItem(session, item);
  });
}
