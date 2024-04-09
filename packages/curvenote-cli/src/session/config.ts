import chalk from 'chalk';
import * as fs from 'node:fs';
import inquirer from 'inquirer';
import path from 'node:path';
import type { Logger } from 'myst-cli-utils';
import { chalkLogger, LogLevel } from 'myst-cli-utils';
import { MyUser } from '../models.js';
import { actionLinks } from '../docs.js';
import { Session } from './session.js';

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

interface TokenData {
  tokens?: { api: string; email: string; username: string; token: string }[];
  token: string;
}

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
    token = resp.token;
  }
  const session = new Session(token, { skipProjectLoading: true });
  let me;
  try {
    me = await new MyUser(session).get();
  } catch (error) {
    throw new Error(`There was a problem with the token for ${session.API_URL}`);
  }
  if (!me.data.email_verified) throw new Error('Your account is not activated');
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
  }

  const existing = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath).toString())
    : {};

  const data = {
    tokens: [
      ...(existing.tokens ?? []),
      { api: session.API_URL, email: me.data.email, username: me.data.username, token },
    ],
    token,
  };

  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(data));
  session.log.info(
    chalk.green(`Token set for @${me.data.username} <${me.data.email}> at ${session.API_URL}.`),
  );
}

export async function selectToken(log: Logger) {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    log.error(`🫙 No tokens found. Try running ${chalk.bold('curvenote token set')} first.`);
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath).toString()) as TokenData;
  if (config.tokens && config.tokens.length === 0) {
    log.error(`🫙 No tokens found. Try running ${chalk.bold('curvenote token set')} first.`);
    return;
  }

  if (config.tokens && config.tokens.length === 1) {
    log.info(
      chalk.green(
        `1️⃣ Using token for @${config.tokens[0].username} <${config.tokens[0].email}> at ${config.tokens[0].api}. This is the only token currently set.`,
      ),
    );
    return;
  }

  if (config.token && !config.tokens) {
    log.info(
      chalk.green(`1️⃣ Only one token is set, run 'curvenote auth list' to see the token details.`),
    );
    return;
  }

  const resp = await inquirer.prompt([
    {
      name: 'selected',
      type: 'list',
      message: 'Which token would you like to use?',
      choices: (config.tokens ?? []).map(
        (t: { api: string; username: string; email: string; token: string }) => ({
          name: `@${t.username} <${t.email}> at ${t.api} ${
            t.token === config.token ? '(active)' : ''
          }`,
          value: t,
        }),
      ),
    },
  ]);

  const updated = {
    ...config,
    token: resp.selected.token,
  };

  fs.writeFileSync(configPath, JSON.stringify(updated));
  log.info(
    chalk.green(
      `Token set for @${resp.selected.username} <${resp.selected.email}> at ${resp.selected.api}.`,
    ),
  );
}

export async function selectAnonymousToken(log: Logger) {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    log.error(`🫙 No saved tokens; your session will be anonymous.`);
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath).toString()) as TokenData;
  if ((config.tokens && config.tokens.length === 0) || !config.token) {
    log.error(`🫙 No saved tokens; your session will be anonymous.`);
    return;
  }

  if (config.token && !config.tokens) {
    log.error(
      `🛟 Session has an unsaved token. To run anonymously you must explicitly run ${chalk.bold('curvenote token delete')}.`,
    );
    return;
  }

  const updated = {
    ...config,
    token: undefined,
  };

  fs.writeFileSync(configPath, JSON.stringify(updated));
  log.info(chalk.green(`Anonymous session selected.`));
}

export function deleteToken(logger: Logger = chalkLogger(LogLevel.info, process.cwd())) {
  const configPath = getConfigPath();
  const env = process.env.CURVENOTE_TOKEN;
  if (env) {
    logger.error('Found CURVENOTE_TOKEN in your process. This command will *not* unset that.');
    logger.info('To unset the token from your environment, try:');
    logger.info('unset CURVENOTE_TOKEN');
  }
  if (!fs.existsSync(configPath)) {
    logger.error('There was no token found in your config to delete.');
    return;
  }
  fs.unlinkSync(configPath);
  logger.info(chalk.green('All tokens have been deleted.'));
}

export function getToken(
  logger: Logger = chalkLogger(LogLevel.info, process.cwd()),
): string | undefined {
  const env = process.env.CURVENOTE_TOKEN;
  if (env) {
    logger.warn('Using the CURVENOTE_TOKEN env variable.');
    return env;
  }
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return undefined;
  try {
    const data = JSON.parse(fs.readFileSync(configPath).toString());
    return data.token;
  } catch (error) {
    logger.debug(`\n\n${(error as Error)?.stack}\n\n`);
    throw new Error('Could not read settings');
  }
}

export function getTokens(logger: Logger = chalkLogger(LogLevel.info, process.cwd())) {
  const env = process.env.CURVENOTE_TOKEN;
  if (env) {
    logger.warn('Using the CURVENOTE_TOKEN env variable.');
    return {
      environment: process.env.CURVENOTE_TOKEN,
    };
  }
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(configPath).toString()) as TokenData;
    return {
      saved: data.tokens,
      current: data.token,
      environment: process.env.CURVENOTE_TOKEN,
    };
  } catch (error) {
    logger.debug(`\n\n${(error as Error)?.stack}\n\n`);
    throw new Error('Could not read settings');
  }
}
