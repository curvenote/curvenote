import { Command, Option } from 'commander';
import { makeYesOption } from 'myst-cli';
import { clirun } from './clirun.js';
import {
  makeDraftOption,
  makeKindOption,
  makeResumeOption,
  makeMaxSizeWebpOption,
  makeVenueOption,
  makeCollectionOption,
  makeNewOption,
} from './options.js';
import { submissions } from '@curvenote/cli';

function makeSubmitCLI(program: Command) {
  const command = new Command('submit')
    .description('Submit your work to a Venue')
    .argument('[venue]', 'Venue to submit the work to')
    .addOption(makeKindOption())
    .addOption(makeCollectionOption())
    .addOption(makeDraftOption())
    .addOption(makeNewOption())
    .addOption(makeYesOption())
    .addOption(makeResumeOption())
    .addOption(makeMaxSizeWebpOption(3))
    .action(clirun(submissions.submit, { program, requireSiteConfig: true }));
  return command;
}

export function addSubmitCLI(program: Command): void {
  program.addCommand(makeSubmitCLI(program));
}

function makeSubmissionCLI() {
  const command = new Command('submission').alias('sub').description('Manage your submission(s)');
  return command;
}

function makeSubmissionListCLI(program: Command) {
  const command = new Command('list')
    .description('List your Submissions')
    .addOption(makeVenueOption('Filter list of submissions by venue'))
    .action(clirun(submissions.list, { program, requireSiteConfig: true }));
  return command;
}

function makeSubmissionPublishCLI(program: Command) {
  const command = new Command('publish')
    .description('Publish your Submission')
    .argument('[venue]', 'Venue to publish the submission to')
    .addOption(
      new Option(
        '-f, --force',
        'If the publish action is not available, do not throw an error',
      ).default(false),
    )
    .addOption(
      new Option(
        '--date [value]',
        'Set different publish date than today. If no argument is provided for this option, frontmatter date will be used.',
      ),
    )
    .action(clirun(submissions.publish, { program, requireSiteConfig: true }));
  return command;
}

function makeSubmissionUnpublishCLI(program: Command) {
  const command = new Command('unpublish')
    .description('Unpublish an existing Submission')
    .argument('[venue]', 'Venue to unpublish the submission from')
    .addOption(
      new Option(
        '-f, --force',
        'If the unpublish action is not available, do not throw an error',
      ).default(false),
    )
    .action(clirun(submissions.unpublish, { program, requireSiteConfig: true }));
  return command;
}

export function addSubmissionCLI(program: Command): void {
  const submissionProgram = makeSubmissionCLI();
  submissionProgram.addCommand(makeSubmissionListCLI(program));
  submissionProgram.addCommand(makeSubmissionPublishCLI(program));
  submissionProgram.addCommand(makeSubmissionUnpublishCLI(program));

  program.addCommand(submissionProgram);
}
