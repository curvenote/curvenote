import { Command, Option } from 'commander';
import { clirun } from './clirun.js';
import {
  makeDraftOption,
  makeKindOption,
  makeResumeOption,
  makeMaxSizeWebpOption,
  makeVenueOption,
  makeYesOption,
} from './options.js';
import { submissions } from '@curvenote/cli';

function makeSubmitCLI(program: Command) {
  const command = new Command('submit')
    .description('Submit your work to a Venue')
    .argument('[venue]', 'Venue to submit the work to')
    .addOption(makeKindOption())
    .addOption(makeDraftOption())
    .addOption(makeYesOption())
    .addOption(makeResumeOption())
    .addOption(makeMaxSizeWebpOption(1000))
    .addOption(
      new Option(
        '--key <string>',
        'Use a unique string as the key for the submission. Set `--key=git` to autogenerate a key based on your git repository.',
      ),
    )
    .action(clirun(submissions.submit, { program, requireSiteConfig: true }));
  return command;
}

export function addSubmitCLI(program: Command): void {
  program.addCommand(makeSubmitCLI(program));
}

function makeSubmissionsCLI() {
  const command = new Command('submissions').description('Manage your submissions');
  return command;
}

function makeSubmissionsListCLI(program: Command) {
  const command = new Command('list')
    .description('List your Submissions')
    .addOption(makeVenueOption('Filter list of submissions by venue'))
    .action(clirun(submissions.list, { program, requireSiteConfig: true }));
  return command;
}

export function addSubmissionsCLI(program: Command): void {
  const submissionsProgram = makeSubmissionsCLI();
  submissionsProgram.addCommand(makeSubmissionsListCLI(program));

  program.addCommand(submissionsProgram);
}
