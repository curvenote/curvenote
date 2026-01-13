import chalk from 'chalk';
import inquirer from 'inquirer';
import type { Logger } from 'myst-cli-utils';
import { chalkLogger, LogLevel } from 'myst-cli-utils';
import type { TokenData } from '../types.js';
import Table from 'cli-table3';
import {
  decodeTokenAndCheckExpiry,
  getCurrentTokenRecord,
  getTokens,
  summarizeAsString,
  updateCurrentTokenConfig,
  writeConfigFile,
} from '../tokens.js';
import { formatDate } from '../../submissions/utils.js';
import { showActiveTokenRecord } from './showCurrentTokenRecord.js';

export * from './checkUserTokenStatus.js';
export * from './setUserToken.js';
export * from './showCurrentTokenRecord.js';

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
          let name = token === data.current ? `${line} (active)` : `${line}`;
          const { expired } = decodeTokenAndCheckExpiry(t.token, log, false);
          if (expired === 'soon') name = chalk.yellow(name + ' (expiring soon)');
          else if (expired) name = chalk.red(name + ' (expired)');
          else if (token === data.current) name = chalk.green(name);
          if (token === data.current) name = chalk.bold(name);
          return { name, value: t, expired };
        },
      ),
    },
  ]);
  updateCurrentTokenConfig(log, resp.selected.token);
  const { note, email, api, username, expired } = resp.selected;
  let message = `Token set for ${summarizeAsString({ note, email, username, api })}.`;
  if (expired === 'soon') {
    message = chalk.yellow(message);
  } else if (expired) {
    message = chalk.red(message);
  } else {
    message = chalk.green(message);
  }
  log.info(chalk.bold(message));
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
export async function listUserTokens(log: Logger) {
  const data = getTokens();
  if (!data.current && !data.saved?.length) {
    log.error(
      'You have no tokens available; you can set a new token with: `curvenote token set API_TOKEN`',
    );
    return;
  }

  const active = getCurrentTokenRecord(data);
  if (active) {
    const { expired } = decodeTokenAndCheckExpiry(active.token, log, false, 'user');
    showActiveTokenRecord(log, active, expired);
  }

  const table = new Table({
    head: ['Active', 'User', 'API', 'Expires', 'Note'],
  });

  log.info(`\nAvailable tokens:`);
  for (const t of data.saved ?? []) {
    const name = t.username ? `${t.username}\n${t.email}` : t.email;
    const { decoded, expired } = decodeTokenAndCheckExpiry(t.token, log, false);
    const expiry =
      decoded.exp && !decoded.ignoreExpiration
        ? formatDate(new Date(decoded.exp * 1000).toISOString())
        : 'no expiry';
    const styledExpiry =
      expired === 'soon' ? chalk.yellow(expiry) : expired ? chalk.red(expiry) : expiry;
    table.push(
      [
        t.token === data.current ? '(active)' : '',
        name,
        t.api,
        styledExpiry,
        t.note ? t.note : '',
      ].map((i) => (t.token === data.current ? chalk.green(i) : i)),
    );
  }

  log.info(table.toString());

  if (data.environment) {
    log.info(`➕ CURVENOTE_TOKEN set in your environment. (active)`);
  }
}
