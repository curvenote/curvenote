import { Command } from 'commander';
import { clirun } from './clirun.js';
import { auth } from '@curvenote/cli';

export function addAuthCLI(program: Command) {
  const command = new Command('auth').description('Check if you are logged into the API');
  command
    .command('list')
    .description('List ')
    .action(clirun(auth.checkAuth, { program, skipProjectLoading: true }))
    .alias('check');
  program.addCommand(command);
}
