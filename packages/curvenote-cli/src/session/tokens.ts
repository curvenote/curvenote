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

// // TODO session.refreshSessionToken
// export async function getOrFetchSessionToken(
//   session: ISession,
//   tokens: Tokens,
// ): Promise<Token | undefined> {
//   if (!tokens.user) {
//     if (!tokens.session) return undefined;
//     decodeTokenAndCheckExpiry(tokens.session.token, session.log);
//     return tokens.session;
//   }

//   // There is a user token, meaning refresh is possible
//   if (tokens.session) {
//     // check current session token
//     const { expired } = decodeTokenAndCheckExpiry(
//       tokens.session.token,
//       session.log,
//       false, // don't throw if expired
//     );
//     if (!expired) return tokens.session;
//     if (expired === 'soon') {
//       session.log.debug('SessionToken: The session token will expire soon.');
//     } else {
//       session.log.debug('SessionToken: The session token has expired.');
//     }
//   }

//   // TODO session.refreshSessionToken
//   // The session token hasn't been created, has expired or will 'soon'.
//   session.log.debug('SessionToken: Generating a fresh session token.');
//   const {
//     decoded: { aud },
//   } = decodeTokenAndCheckExpiry(tokens.user.token, session.log);
//   const response = await session.fetch(aud as string, {
//     method: 'post',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${tokens.user}`,
//     },
//   });
//   if (!response.ok) {
//     console.error(
//       chalk.bold(
//         '⛔️ There was a problem with your API token. If the error persists try generating a new token or contact support@curvenote.com.',
//       ),
//     );
//     throw new Error('SessionToken: The user token is not valid.');
//   }
//   const json = (await response.json()) as { session?: string };
//   if (!json.session)
//     throw new Error(
//       "SessionToken: There was an error in the response, expected a 'session' in the JSON object.",
//     );
//   const decoded = jwt.decode(json.session) as Token['decoded'];
//   return { token: json.session, decoded };
// }

// /**
//  * SIDE EFFECTS - sets the session token in the tokens argument
//  * TODO: session.getHeaders
//  *
//  * @param session
//  * @param tokens
//  * @returns
//  */
// export async function getHeadersWithSideEffects(
//   session: ISession,
//   tokens: Tokens,
// ): Promise<Record<string, string>> {
//   const headers: Record<string, string> = {
//     'X-Client-Name': XClientName.javascript,
//     'X-Client-Version': CLIENT_VERSION,
//   };
//   const sessionToken = await getOrFetchSessionToken(session, tokens);
//   if (sessionToken) {
//     tokens.session = sessionToken;
//     headers.Authorization = `Bearer ${sessionToken}`;
//   }
//   return headers;
// }
