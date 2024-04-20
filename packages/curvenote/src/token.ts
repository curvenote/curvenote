import { Command } from 'commander';
import {
  listTokens,
  deleteToken,
  setToken,
  selectToken,
  selectAnonymousToken,
} from '@curvenote/cli';
import { clirun } from './clirun.js';

export function addTokenCLI(program: Command) {
  const command = new Command('token')
    .description('Set or delete a token to access the Curvenote API')
    .alias('auth');
  command
    .command('list')
    .alias('check')
    .description('Check if you are logged into the API and list available tokens')
    .action(clirun(listTokens, { program, skipProjectLoading: true }));
  command
    .command('set [token]')
    .description('Set a token and save to a config directory')
    .action(
      clirun(async (session, token?: string) => setToken(session.log, token), {
        program,
        anonymous: true,
        skipProjectLoading: true,
      }),
    );
  command
    .command('select')
    .description('Set a token and save to a config directory')
    .action(
      clirun(async (session) => selectToken(session.log), {
        program,
        anonymous: true,
        skipProjectLoading: true,
      }),
    );
  command
    .command('anonymous')
    .alias('anon')
    .description('Use an anonymous session, without deleting your saved tokens')
    .action(
      clirun((session) => selectAnonymousToken(session.log), {
        program,
        anonymous: true,
        skipProjectLoading: true,
      }),
    );
  command
    .command('delete')
    .alias('remove')
    .description('Delete active token the config directory')
    .option('--all', 'Delete all saved tokens, not just active token')
    .action(
      clirun((session, opts) => deleteToken(session.log, opts), {
        program,
        anonymous: true,
        skipProjectLoading: true,
      }),
    );
  program.addCommand(command);
}
