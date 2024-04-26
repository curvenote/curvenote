import { LogLevel, chalkLogger } from 'myst-cli-utils';
import type { ISession, SessionOpts } from './types.js';
import { Session } from './session.js';
import { getTokens } from './auth.js';

/**
 * Duplicated from myst-cli-utils, where function is not exported
 */
function getLogLevel(level: LogLevel | boolean | string = LogLevel.info): LogLevel {
  if (typeof level === 'number') return level;
  const useLevel: LogLevel = level ? LogLevel.debug : LogLevel.info;
  return useLevel;
}

export function anonSession(opts?: SessionOpts): ISession {
  const logger = chalkLogger(getLogLevel(opts?.debug), process.cwd());
  const session = new Session(undefined, { logger, skipProjectLoading: opts?.skipProjectLoading });
  return session;
}

export function getSession(opts?: SessionOpts & { hideNoTokenWarning?: boolean }): ISession {
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
    session = new Session(data.current, { logger, skipProjectLoading: opts?.skipProjectLoading });
  } catch (error) {
    logger.error((error as Error).message);
    process.exit(1);
  }
  return session;
}
