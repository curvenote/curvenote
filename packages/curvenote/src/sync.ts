import { Command } from 'commander';
import { makeYesOption } from 'myst-cli';
import { sync } from '@curvenote/cli';
import { clirun } from './clirun.js';
import {
  makeBranchOption,
  makeDomainOption,
  makeForceOption,
  makeWriteTOCOption,
  makeCIOption,
} from './options.js';

function makeInitCLI(program: Command) {
  const command = new Command('init')
    .description('Initialize a Curvenote project')
    .addOption(makeForceOption())
    .addOption(makeBranchOption())
    .addOption(makeYesOption())
    .addOption(makeDomainOption())
    .addOption(makeWriteTOCOption())
    .action(clirun(sync.init, { program, hideNoTokenWarning: true, keepAlive: true }));
  return command;
}

function makePullCLI(program: Command) {
  const command = new Command('pull')
    .description('Pull all remote information for a Curvenote project')
    .argument(
      '[path]',
      'The location of the project or file to update, defaults to the current directory',
    )
    .addOption(makeYesOption())
    .addOption(makeCIOption())
    .action(clirun(sync.pull, { program }));
  return command;
}

function makeCloneCLI(program: Command) {
  const command = new Command('clone')
    .description('Clone a Curvenote project')
    .argument('[remote]', 'Curvenote link to a project')
    .argument('[folder]', 'The location of the content to clone')
    .addOption(makeYesOption())
    .addOption(makeCIOption())
    .action(clirun(sync.clone, { program }));
  return command;
}

export function addSyncCLI(program: Command) {
  program.addCommand(makeInitCLI(program));
  program.addCommand(makeCloneCLI(program));
  program.addCommand(makePullCLI(program));
}
