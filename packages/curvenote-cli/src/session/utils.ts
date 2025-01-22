import { LogLevel, chalkLogger } from 'myst-cli-utils';
import type { ISession, SessionOpts } from './types.js';
import { Session } from './session.js';
import { getTokens } from './auth.js';
import boxen from 'boxen';
import chalk from 'chalk';

export function logUpdateRequired({
  current,
  minimum,
  upgradeCommand,
  twitter,
}: {
  current: string;
  minimum: string;
  upgradeCommand: string;
  twitter: string;
}) {
  return boxen(
    `Upgrade Required! ${chalk.dim(`v${current}`)} ≫ ${chalk.green.bold(
      `v${minimum} (minimum)`,
    )}\n\nRun \`${chalk.cyanBright.bold(
      upgradeCommand,
    )}\` to update.\n\nFollow ${chalk.yellowBright(
      `@${twitter}`,
    )} for updates!\nhttps://twitter.com/${twitter}`,
    {
      padding: 1,
      margin: 1,
      borderColor: 'red',
      borderStyle: 'round',
      textAlignment: 'center',
    },
  );
}

/**
 * Duplicated from myst-cli-utils, where function is not exported
 */
function getLogLevel(level: LogLevel | boolean | string = LogLevel.info): LogLevel {
  if (typeof level === 'number') return level;
  const useLevel: LogLevel = level ? LogLevel.debug : LogLevel.info;
  return useLevel;
}

export async function anonSession(opts?: SessionOpts): Promise<ISession> {
  const logger = chalkLogger(getLogLevel(opts?.debug), process.cwd());
  const session = await Session.create(undefined, { logger });
  return session;
}

export async function getSession(
  opts?: SessionOpts & { hideNoTokenWarning?: boolean },
): Promise<ISession> {
  const logger = chalkLogger(getLogLevel(opts?.debug), process.cwd());
  const data = getTokens(logger);
  if (!data.current && !opts?.hideNoTokenWarning) {
    logger.warn('No token was found in settings or CURVENOTE_TOKEN. Session is not authenticated.');
    logger.info('You can set a new token with: `curvenote token set API_TOKEN`');
    if (data.saved?.length) {
      logger.info('or you can select an existing token with: `curvenote token select`');
    }
  }
  let session;
  try {
    session = await Session.create(data.current, { logger });
  } catch (error) {
    logger.error((error as Error).message);
    process.exit(1);
  }
  return session;
}
