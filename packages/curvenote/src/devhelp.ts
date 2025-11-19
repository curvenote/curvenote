import type { Command } from 'commander';
import { clirun } from './clirun.js';
import chalk from 'chalk';
import type { ISession } from '@curvenote/cli';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function devhelp(session: ISession) {
  const message = `🚀 Curvenote CLI Developer Help 🚀

    ${chalk.bold('Testing without uploading')}
    
    Run: DEV_CDN=true cn deploy -d
    Using any valid CDN key in place of 'true'.
    `;

  console.log(message);
}

export function makeDevHelpCLI(program: Command) {
  const command = program
    .command('devhelp', { hidden: true })
    .action(clirun(devhelp, { program, skipProjectLoading: true }));
  return command;
}

export function addDevHelpCLI(program: Command) {
  program.addCommand(makeDevHelpCLI(program));
}
