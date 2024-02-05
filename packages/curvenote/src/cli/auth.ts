import { Command } from 'commander';
import { MyUser } from '../models.js';
import type { ISession } from '../session/types.js';
import { clirun } from './utils.js';
import { getTokens } from '../index.js';

async function checkAuth(session: ISession) {
  if (session.isAnon) {
    session.log.error('Your session is not authenticated.');
    return;
  }
  const me = await new MyUser(session).get();
  session.log.info(`Authenticating at ${session.API_URL}`);
  session.log.info(`Logged in as @${me.data.username} <${me.data.email}> at ${session.API_URL}`);

  const data = getTokens();
  if (data.environment && !data.current) return;
  session.log.info(`Available tokens:`);
  for (const t of data.saved ?? []) {
    session.log.info(
      `@${t.username} <${t.email}> at ${t.api} ${t.token === data.current ? '(active)' : ''}`,
    );
  }
  if (data.environment) {
    session.log.info(`➕ Plus an additional token is set in your environment.`);
  }
}

export function addAuthCLI(program: Command) {
  const command = new Command('auth').description('Check if you are logged into the API');
  command.command('list').description('List ').action(clirun(checkAuth, { program }));
  program.addCommand(command);
}
