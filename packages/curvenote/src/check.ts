import { Command } from 'commander';
import { makeYesOption } from 'myst-cli';
import { submissions } from '@curvenote/cli';
import { clirun } from './clirun.js';
import { makeCollectionOption, makeKindOption } from './options.js';

export function makeCheckCLI(program: Command) {
  const command = new Command('check')
    .description('Run checks from plugins or example checks on your MyST project')
    .argument('[venue]', 'Venue to check the submission against locally')
    .addOption(makeKindOption())
    .addOption(makeCollectionOption())
    .addOption(makeYesOption())
    .action(clirun(submissions.check, { program }));
  return command;
}

export function addCheckCLI(program: Command) {
  program.addCommand(makeCheckCLI(program));
}
