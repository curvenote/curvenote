import { chalkLogger } from 'myst-cli-utils';
import { getLogLevel } from '../utils/utils.js';
import type { ISession, SessionOpts } from './types.js';
import { Session } from './session.js';
import { getToken } from './config.js';

export function anonSession(opts?: SessionOpts): ISession {
  const logger = chalkLogger(getLogLevel(opts?.debug), process.cwd());
  const session = new Session(undefined, { logger, skipProjectLoading: opts?.skipProjectLoading });
  return session;
}

export function getSession(opts?: SessionOpts & { hideNoTokenWarning?: boolean }): ISession {
  const logger = chalkLogger(getLogLevel(opts?.debug), process.cwd());
  const token = getToken(logger);
  if (!token && !opts?.hideNoTokenWarning) {
    logger.warn('No token was found in settings or CURVENOTE_TOKEN. Session is not authenticated.');
    logger.info('You can set a token with:');
    logger.info('curvenote token set API_TOKEN');
  }
  let session;
  try {
    session = new Session(token, { logger, skipProjectLoading: opts?.skipProjectLoading });
  } catch (error) {
    logger.error((error as Error).message);
    logger.info('You can remove your token using:');
    logger.info('curvenote token remove');
    process.exit(1);
  }
  return session;
}
