import chalk from 'chalk';
import * as fs from 'node:fs';
import inquirer from 'inquirer';
import path from 'node:path';
import type { Logger } from 'myst-cli-utils';
import { chalkLogger, LogLevel } from 'myst-cli-utils';
import { MyUser } from '../models.js';
import { actionLinks } from '../docs.js';
import type { ISession } from './types.js';
import { Session } from './session.js';
import Table from 'cli-table3';
import { decodeTokenAndCheckExpiry } from './tokens.js';
import { formatDate } from '../submissions/utils.js';

interface TokenData {
  api: string;
  email: string;
  username?: string;
  note?: string;
  token: string;
}

interface TokenConfig {
  tokens?: TokenData[];
  token?: string;
}

function getConfigPath() {
  const pathArr: string[] = [];
  const local = ['curvenote', 'settings.json'];
  if (process.env.APPDATA) {
    pathArr.push(process.env.APPDATA);
  } else if (process.platform === 'darwin' && process.env.HOME) {
    pathArr.push(path.join(process.env.HOME, '.config'));
  } else if (process.env.HOME) {
    pathArr.push(process.env.HOME);
    if (local.length > 0) {
      local[0] = `.${local[0]}`;
    }
  }
  return path.join(...pathArr, ...local);
}

/**
 * Return `current` token and `saved` available tokens
 *
 * Curvenote tokens can come from 2 places:
 * - CURVENOTE_TOKEN environment variable
 * - Curvenote config file saved to your system
 *
 * The curvenote config may have a list of available tokens and a current token;
 * this function will return the available tokens as `saved` and the `current` token.
 *
 * If CURVENOTE_TOKEN environment variable is found, it will be returned as `current`,
 * taking priority over any current token in your config file. The field `environment`
 * will be set to `true`, indicating current came from the environment variable.
 */
export function getTokens(log: Logger = chalkLogger(LogLevel.info, process.cwd())): {
  saved?: TokenData[];
  current?: string;
  environment?: boolean;
} {
  const env = process.env.CURVENOTE_TOKEN;
  if (env) {
    log.warn('Using the CURVENOTE_TOKEN env variable.');
  }
  const configPath = getConfigPath();
  let config: TokenConfig | undefined;
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath).toString());
    } catch (error) {
      log.debug(`\n\n${(error as Error)?.stack}\n\n`);
      if (env) {
        log.error('Could not read settings file; continuing with CURVENOTE_TOKEN env variable');
      } else {
        throw new Error('Could not read settings file to get Curvenote token');
      }
    }
  }
  return {
    saved: config?.tokens,
    current: env ?? config?.token,
    environment: !!env,
  };
}

/**
 * Write token config data to file
 */
function writeConfigFile(data: TokenConfig) {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(data));
}

/**
 * Replace current token in saved config file
 */
function updateCurrentTokenConfig(log: Logger, token?: string) {
  const { saved } = getTokens();
  writeConfigFile({ tokens: saved, token });
}

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

function summarizeAsString({ note, username, email, api }: Omit<TokenData, 'token'>) {
  return `"${username}" <${email}> at ${api}${note ? ` (${note})` : ''}`;
}

/**
 * Interactively select a saved token to use
 */
export async function selectToken(session: Session) {
  const log = session.log;
  const data = getTokens(log);
  if (!data.current && !data.saved?.length) {
    log.error(`🫙 No tokens found. Try running ${chalk.bold('curvenote token set')} first.`);
    return;
  }
  if (data.environment && data.current) {
    log.error(
      `🌎 Token from CURVENOTE_TOKEN environment variable in use; you must remove this before selecting another token`,
    );
    log.error('To unset the token from your environment, try: `unset CURVENOTE_TOKEN`');
    return;
  }
  if (data.saved?.length === 1 && data.current === data.saved[0].token) {
    const { username, email, api, note } = data.saved[0];
    log.info(
      chalk.green(
        `1️⃣ Using token for ${summarizeAsString({ note, email, username, api })}. This is the only token currently set.`,
      ),
    );
    return;
  }
  if (data.current && !data.saved?.length) {
    log.info(
      chalk.green(`1️⃣ Only one token is set, run 'curvenote token list' to see the token details.`),
    );
    return;
  }
  const resp = await inquirer.prompt([
    {
      name: 'selected',
      type: 'list',
      message: 'Which token would you like to use?',
      choices: (data.saved ?? []).map(
        (t: { api: string; note?: string; username?: string; email: string; token: string }) => {
          const { note, email, username, api, token } = t;
          const line = `${summarizeAsString({ note, email, username, api })}`;
          const name =
            token === data.current ? chalk.bold(chalk.green(`${line} (active)`)) : `${line}`;
          return { name, value: t };
        },
      ),
    },
  ]);
  updateCurrentTokenConfig(log, resp.selected.token);
  const { note, email, api, username } = resp.selected;
  log.info(chalk.green(`Token set for ${summarizeAsString({ note, email, username, api })}.`));
}

/**
 * Remove current token without deleting saved tokens, allowing anonymous sessions
 */
export async function selectAnonymousToken(log: Logger) {
  const data = getTokens(log);
  if (!data.current) {
    log.error(`🫙 No current token selected; your session will be anonymous.`);
    return;
  }
  if (data.environment && data.current) {
    log.error(`🌎 Token from CURVENOTE_TOKEN environment variable in use`);
    log.error('To unset the token from your environment, try: `unset CURVENOTE_TOKEN`');
    return;
  }
  if (data.current && !data.saved?.find(({ token }) => token === data.current)) {
    log.error(
      `🛟 Session has an unsaved token. To run anonymously you must explicitly run ${chalk.bold('curvenote token delete')}.`,
    );
    return;
  }
  updateCurrentTokenConfig(log, undefined);
  log.info(chalk.green(`Anonymous session selected.`));
}

/**
 * Delete current token
 *
 * If `opts.all` is true, this will remove all saved tokens.
 */
export function deleteToken(
  log: Logger = chalkLogger(LogLevel.info, process.cwd()),
  opts?: { all?: boolean },
) {
  const data = getTokens();
  if (data.environment) {
    log.error(
      `🌎 Active token is from CURVENOTE_TOKEN environment variable; this command will ${chalk.bold('not')} unset that.`,
    );
    log.info('To unset the token from your environment, try: `unset CURVENOTE_TOKEN`');
    if (!opts?.all) return;
  }
  let tokens: TokenData[] | undefined;
  let message: string;
  if (opts?.all) {
    if (!data.saved?.length && (data.environment || !data.current)) {
      log.error('There were no tokens found in your config to delete.');
      return;
    }
    message = '🗑 All tokens have been deleted';
  } else {
    if (!data.current) {
      log.error(
        'There is no active token to delete. To remove all saved tokens, try: `curvenote token remove --all`',
      );
      return;
    }
    tokens = data.saved?.filter(({ token }) => token !== data.current);
    message = '🗑 Active token has been deleted';
  }
  writeConfigFile({ tokens });
  log.info(chalk.green(message));
}

export async function checkUserTokenStatus(session: ISession) {
  if (session.isAnon) {
    session.log.error('Anonymous session, select a token.');
    return;
  }

  const active = showCurrentTokenRecord(session.log);
  if (!active) {
    session.log.error('No active token found');
    return;
  }

  session.log.debug(`Token issued by ${active?.api}`); // active api == audience
  const { decoded, expired } = decodeTokenAndCheckExpiry(active.token, session.log, false);
  session.log.info(`\nToken status: ${expired ? chalk.red('EXPIRED') : chalk.green('CURRENT')}`);
  session.log.info(
    `Expiry: ${decoded.exp ? formatDate(new Date(decoded.exp * 1000).toISOString()) : 'no expiry'}`,
  );

  const model = new MyUser(session);
  const me = await model.get();
  const name = me.data.username ? `@${me.data.username}` : me.data.display_name;
  session.log.info(`Login as ${name} <${me.data.email}> verified by ${model.$createUrl()}`);
}

function showCurrentTokenRecord(log: Logger, tokens?: ReturnType<typeof getTokens>) {
  const active = getCurrentTokenRecord(tokens);
  if (active) {
    log.info(chalk.bold(chalk.green(`\nActive token:`)));
    log.info(chalk.bold(chalk.green(summarizeAsString(active))));
  }
  return active;
}

function getCurrentTokenRecord(tokens?: ReturnType<typeof getTokens>) {
  const data = tokens ?? getTokens();
  if (!data.current) return;
  return data.saved?.find(({ token }) => token === data.current);
}

/**
 * Provide info on the current session token and other saved tokens
 */
export async function listUserTokens(log: Logger) {
  const data = getTokens();
  if (!data.current && !data.saved?.length) {
    log.error(
      'You have no tokens available; you can set a new token with: `curvenote token set API_TOKEN`',
    );
    return;
  }

  if (data.current) showCurrentTokenRecord(log, data);

  const table = new Table({
    head: ['User', 'Email', 'API', 'Active', 'Note'],
  });

  log.info(`\nAvailable tokens:`);
  for (const t of data.saved ?? []) {
    table.push(
      [t.username, t.email, t.api, t.token === data.current ? '(active)' : '', t.note].map((i) =>
        t.token === data.current ? chalk.green(i) : i,
      ),
    );
  }

  log.info(table.toString());

  if (data.environment) {
    log.info(`➕ CURVENOTE_TOKEN set in your environment. (active)`);
  }
}
