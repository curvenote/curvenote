import inquirer from 'inquirer';
import { MyUser } from '../../models.js';
import { getTokens, summarizeAsString, writeConfigFile } from '../tokens.js';
import type { Logger } from 'myst-cli-utils';
import { actionLinks } from '../../docs.js';
import { Session } from '../session.js';
import chalk from 'chalk';

/**
 * Validate token and save to local config file
 *
 * If config file does not exist, it will be created.
 * If config file does exist with saved tokens, this token will be added
 * to the saved tokens and set as the current token.
 */
export async function setUserToken(log: Logger, token?: string) {
  if (!token) {
    log.info(`Create an API token here:\n\n${actionLinks.apiToken}\n`);
    const resp = await inquirer.prompt([
      {
        name: 'token',
        message: 'API Token:',
        type: 'input',
      },
    ]);
    token = resp.token as string;
  }

  log.debug('Creating session with new token');
  const session = await Session.create(token);
  log.debug('User token payload:');
  log.debug(JSON.stringify(session.activeTokens.user?.decoded, null, 2));
  log.debug('Session token payload:');
  log.debug(JSON.stringify(session.activeTokens.session?.decoded, null, 2));

  let me;
  try {
    me = await new MyUser(session).get();
  } catch (error) {
    log.error(error);
    throw new Error(
      `There was a problem with the token for ${session.activeTokens.session?.decoded.aud}`,
    );
  }
  if (!me.data.email_verified) throw new Error('Your account is not activated');
  const data = getTokens();
  const tokens = data.saved ? [...data.saved] : [];
  if (!tokens.find(({ token: t }) => t === token)) {
    tokens.push({
      api: session.activeTokens.user?.decoded.aud ?? 'unknown-audience', // TODO this should be based on the audience
      email: me.data.email,
      username: session.activeTokens.user?.decoded.name ?? me.data.username ?? me.data.display_name,
      note: session.activeTokens.user?.decoded.note,
      token,
    });
  }

  writeConfigFile({ tokens, token });
  const aud = session.activeTokens.user?.decoded.aud ?? 'unknown-audience';
  const note = session.activeTokens.user?.decoded.note;
  const { username, display_name, email } = me.data;
  session.log.info(
    chalk.green(
      `Token set for ${summarizeAsString({ note, email, username: username ?? display_name, api: aud })}.`,
    ),
  );
}
