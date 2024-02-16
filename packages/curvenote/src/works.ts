import { Command } from 'commander';
import { works } from '@curvenote/cli';
import { clirun } from './clirun.js';

function makeWorksCLI() {
  const command = new Command('works').description('Create and manage your Works');
  return command;
}

function makeWorksListCLI(program: Command) {
  const command = new Command('list')
    .description('List your Works')
    .action(clirun(works.list, { program, requireSiteConfig: true }));
  return command;
}

export function addWorksCLI(program: Command): void {
  const worksProgram = makeWorksCLI();
  worksProgram.addCommand(makeWorksListCLI(program));
  program.addCommand(worksProgram);
}
