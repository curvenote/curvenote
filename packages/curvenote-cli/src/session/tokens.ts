import jwt from 'jsonwebtoken';
import type { ISession, Token, TokenPayload } from './types.js';

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
