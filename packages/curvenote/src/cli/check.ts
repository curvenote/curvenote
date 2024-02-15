import { Command } from 'commander';
import { clirun } from './utils.js';
import { makeKindOption } from './options.js';
import { check } from '../submissions/check.js';

export function makeCheckCLI(program: Command) {
  const command = new Command('check')
    .description('Run checks from plugins or example checks on your MyST project')
    .argument('[venue]', 'Venue to check the submission against locally')
    .addOption(makeKindOption())
    .action(clirun(check, { program }));
  return command;
}

export function addCheckCLI(program: Command) {
  program.addCommand(makeCheckCLI(program));
}
