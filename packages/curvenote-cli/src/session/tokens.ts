import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import type { ISession, Token, TokenConfig, TokenData, TokenPayload } from './types.js';
import type { Logger } from 'myst-cli-utils';
import { chalkLogger, LogLevel } from 'myst-cli-utils';
import { getConfigPath } from './utils/index.js';

export function decodeTokenAndCheckExpiry(
  token: string,
  log: ISession['log'],
  throwErrors = true,
): { decoded: TokenPayload; expired: boolean | 'soon' } {
  const rawDecoded = jwt.decode(token);
  if (!rawDecoded || typeof rawDecoded === 'string')
    throw new Error('Could not decode session token. Please ensure that the API token is valid.');
  const decoded = rawDecoded as TokenPayload;
  const timeLeft = (decoded.exp as number) * 1000 - Date.now();
  if (!decoded.ignoreExpiration && timeLeft < 0) {
    if (throwErrors) {
      throw new Error(
        'The API token has expired. You can remove your token using: `curvenote token remove`',
      );
    }
    return { decoded, expired: true };
  }
  if (!decoded.ignoreExpiration && timeLeft < 30 * 1000) {
    if (throwErrors) log.warn('The token has less than 30 seconds remaining');
    return { decoded, expired: 'soon' };
  }
  return { decoded, expired: false };
}

export function validateSessionToken(token: string, log: ISession['log']): Token {
  const { decoded } = decodeTokenAndCheckExpiry(token, log);
  const { aud, cfg, iss } = decoded;
  if (typeof aud !== 'string') throw new Error('Expected an audience on the token (string).');
  if (!iss?.endsWith('tokens/session')) throw new Error('Expected a session token.');
  if (typeof cfg === 'string')
    log.debug(`SessionToken contains a "cfg" claim, reading configuration from api at ${cfg}.`);
  return { token, decoded };
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
