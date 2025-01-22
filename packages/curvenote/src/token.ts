import { Command } from 'commander';
import {
  listUserTokens,
  deleteToken,
  setUserToken,
  selectToken,
  selectAnonymousToken,
  checkUserTokenStatus,
} from '@curvenote/cli';
import { clirun } from './clirun.js';

export function addTokenCLI(program: Command) {
  const token = new Command('token')
    .description('Set or delete a token to access the Curvenote API')
    .alias('auth');
  token
    .command('list')
    .description('Check if you are logged into the API and list available tokens')
    .action(
      clirun(async (session) => listUserTokens(session.log), {
        program,
        anonymous: true,
        skipProjectLoading: true,
      }),
    );
  token
    .command('check')
    .description('Check status of the active token')
    .action(clirun(checkUserTokenStatus, { program, skipProjectLoading: true }));
  token
    .command('set [token]')
    .description('Set a token and save to a config directory')
    .action(
      clirun(async (session, t?: string) => setUserToken(session.log, t), {
        program,
        anonymous: true,
        skipProjectLoading: true,
      }),
    );
  token
    .command('select')
    .description('Set a token and save to a config directory')
    .action(
      clirun((s) => selectToken(s.log), {
        program,
        anonymous: true,
        skipProjectLoading: true,
      }),
    );
  token
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
  token
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
  program.addCommand(token);
}
