import { Command } from 'commander';
import { works } from '@curvenote/cli';
import { clirun } from './clirun.js';
import { makeYesOption } from 'myst-cli';
import { makeResumeOption, makeMaxSizeWebpOption } from './options.js';

function makeWorksCLI() {
  const command = new Command('work').description('Create and manage your Works').alias('works');
  return command;
}

function makeWorksListCLI(program: Command) {
  const command = new Command('list')
    .description('List your Works')
    .action(clirun(works.list, { program, requireSiteConfig: true }));
  return command;
}

function makeWorksPushCLI(program: Command) {
  const command = new Command('push')
    .description('Push a new Work or a new version of an existing Work')
    .option('--public', 'Push to the public CDN instead of the private CDN')
    .addOption(makeYesOption())
    .addOption(makeResumeOption())
    .addOption(makeMaxSizeWebpOption(3))
    .action(clirun(works.push, { program, requireSiteConfig: true }));
  return command;
}

export function addWorksCLI(program: Command): void {
  const worksProgram = makeWorksCLI();
  worksProgram.addCommand(makeWorksListCLI(program));
  worksProgram.addCommand(makeWorksPushCLI(program));
  program.addCommand(worksProgram);
}
