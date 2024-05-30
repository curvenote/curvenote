import chalk from 'chalk';
import * as fs from 'node:fs';
import inquirer from 'inquirer';
import path from 'node:path';
import type { Logger } from 'myst-cli-utils';
import { chalkLogger, LogLevel } from 'myst-cli-utils';
import { MyUser } from '../models.js';
import { actionLinks } from '../docs.js';
import { Session } from './session.js';
import type { ISession } from './types.js';

interface TokenData {
  api: string;
  email: string;
  username: string;
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
export async function setToken(log: Logger, token?: string) {
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
  const session = new Session(token, { skipProjectLoading: true });
  await session.reload()
  let me;
  try {
    me = await new MyUser(session).get();
  } catch (error) {
    throw new Error(`There was a problem with the token for ${session.API_URL}`);
  }
  if (!me.data.email_verified) throw new Error('Your account is not activated');
  const data = getTokens();
  const tokens = data.saved ? [...data.saved] : [];
  if (!tokens.find(({ token: t }) => t === token)) {
    tokens.push({ api: session.API_URL, email: me.data.email, username: me.data.username, token });
  }
  writeConfigFile({ tokens, token });
  session.log.info(
    chalk.green(`Token set for @${me.data.username} <${me.data.email}> at ${session.API_URL}.`),
  );
}

/**
 * Interactively select a saved token to use
 */
export async function selectToken(log: Logger) {
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
    log.info(
      chalk.green(
        `1️⃣ Using token for @${data.saved[0].username} <${data.saved[0].email}> at ${data.saved[0].api}. This is the only token currently set.`,
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
        (t: { api: string; username: string; email: string; token: string }) => ({
          name: `@${t.username} <${t.email}> at ${t.api} ${
            t.token === data.current ? '(active)' : ''
          }`,
          value: t,
        }),
      ),
    },
  ]);
  updateCurrentTokenConfig(log, resp.selected.token);
  log.info(
    chalk.green(
      `Token set for @${resp.selected.username} <${resp.selected.email}> at ${resp.selected.api}.`,
    ),
  );
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

/**
 * Provide info on the current session token and other saved tokens
 */
export async function listTokens(session: ISession) {
  if (session.isAnon) {
    session.log.error('Your session is not authenticated.');
  } else {
    const me = await new MyUser(session).get();
    session.log.info(`Authenticating at ${session.API_URL}`);
    session.log.info(`Logged in as @${me.data.username} <${me.data.email}> at ${session.API_URL}`);
  }

  const data = getTokens();
  if (!data.current && !data.saved?.length) {
    session.log.error(
      'You have no tokens available; you can set a new token with: `curvenote token set API_TOKEN`',
    );
    return;
  }
  session.log.info(`\nAvailable tokens:`);
  for (const t of data.saved ?? []) {
    session.log.info(
      `@${t.username} <${t.email}> at ${t.api}${t.token === data.current ? ' (active)' : ''}`,
    );
  }
  if (data.environment) {
    session.log.info(`➕ CURVENOTE_TOKEN set in your environment. (active)`);
  }
}
