import { Command, Option } from 'commander';
import * as works from '../works/index.js';
import { clirun } from './utils.js';
import { makeCIOption, makeYesOption } from './options.js';

function makeWorksCLI(program: Command) {
  const command = new Command('works').description('Create and manage your Works');
  return command;
}

function makeUpdateOption() {
  return new Option('--update <string>', 'Add a new version to an existing Work');
}

function makeKindOption() {
  return new Option('--kind <string>', 'Submit to the venue using this submission kind');
}

function makeWorksCreateCLI(program: Command) {
  const command = new Command('create')
    .description('Create a new Work')
    .addOption(makeUpdateOption())
    .addOption(makeCIOption())
    .addOption(makeYesOption())
    .action(clirun(works.create, { program, requireSiteConfig: true }));
  return command;
}

function makeWorksListCLI(program: Command) {
  const command = new Command('list')
    .description('List your Works')
    .action(clirun(works.list, { program, requireSiteConfig: true }));
  return command;
}

function makeWorkSubmitCLI(program: Command) {
  const command = new Command('submit')
    .description('Submit a Work to a Venue')
    .argument('<venue>', 'Venue to submit the work to')
    .addOption(makeKindOption())
    .addOption(makeYesOption())
    .action(clirun(works.submit, { program, requireSiteConfig: true }));
  return command;
}

export function addWorksCLI(program: Command): void {
  const worksProgram = makeWorksCLI(program);
  worksProgram.addCommand(makeWorksCreateCLI(program));
  worksProgram.addCommand(makeWorksListCLI(program));
  worksProgram.addCommand(makeWorkSubmitCLI(program));

  program.addCommand(worksProgram);
}
