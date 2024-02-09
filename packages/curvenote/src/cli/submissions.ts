import { Command, Option } from 'commander';
import { clirun } from './utils.js';
import { makeYesOption } from './options.js';
import * as submissions from '../submissions/index.js';

function makeKindOption() {
  return new Option('--kind <string>', 'Submit to the venue using this submission kind');
}

function makeVenueOption() {
  return new Option('--venue <string>', 'Filter list of submissions by venue');
}

function makeDraftOption() {
  return new Option('--draft', 'Make an draft submission');
}

function makeSubmitCLI(program: Command) {
  const command = new Command('submit')
    .description('Submit your work to a Venue')
    .argument('[venue]', 'Venue to submit the work to')
    .addOption(makeKindOption())
    .addOption(makeDraftOption())
    .addOption(makeYesOption())
    .addOption(new Option('--repo <string>', 'Source repo for the submission'))
    .addOption(new Option('--branch <string>', 'Source branch for the submission'))
    .addOption(new Option('--path <string>', 'Source path for the submission'))
    .addOption(new Option('--commit <string>', 'Source commit hash for the submission'))
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
    .addOption(makeVenueOption())
    .action(clirun(submissions.list, { program, requireSiteConfig: true }));
  return command;
}

export function addSubmissionsCLI(program: Command): void {
  const submissionsProgram = makeSubmissionsCLI();
  submissionsProgram.addCommand(makeSubmissionsListCLI(program));

  program.addCommand(submissionsProgram);
}
