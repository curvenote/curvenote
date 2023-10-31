import { Command, Option } from 'commander';
import { clirun } from './utils.js';
import { makeYesOption } from './options.js';
import * as submissions from '../submissions/index.js';

function makeKindOption() {
  return new Option('--kind <string>', 'Submit to the venue using this submission kind');
}

function makeInfoOption() {
  return new Option('--info', 'Display submission information for the venue');
}

function makeSubmitCLI(program: Command) {
  const command = new Command('submit')
    .description('Submit your work to a Venue')
    .argument('[venue]', 'Venue to submit the work to')
    .addOption(makeKindOption())
    .addOption(makeYesOption())
    .addOption(makeInfoOption())
    .action(clirun(submissions.submit, { program, requireSiteConfig: true }));
  return command;
}

export function addSubmitCLI(program: Command): void {
  program.addCommand(makeSubmitCLI(program));
}

function makeSubmissionsCLI() {
  const command = new Command('submit').description('Create and manage submissions to venues');
  return command;
}

function makeSubmissionsListCLI(program: Command) {
  const command = new Command('list')
    .description('List your Submissions')
    .action(clirun(submissions.list, { program, requireSiteConfig: true }));
  return command;
}

export function addSubmissionsCLI(program: Command): void {
  const submissionsProgram = makeSubmissionsCLI();
  submissionsProgram.addCommand(makeSubmissionsListCLI(program));

  program.addCommand(submissionsProgram);
}
