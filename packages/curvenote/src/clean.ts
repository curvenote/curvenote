import type { Command } from 'commander';
import { clean, makeCleanCommand } from 'myst-cli';
import { clirun } from './clirun.js';

export function makeCleanCLI(program: Command) {
  const command = makeCleanCommand().action(clirun(clean, { program }));
  return command;
}

export function addCleanCLI(program: Command) {
  program.addCommand(makeCleanCLI(program));
}
