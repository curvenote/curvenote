import jwt from 'jsonwebtoken';
import { error401 } from '@curvenote/scms-core';

/**
 * JWT helpers and claim shapes used when building request context (session, preview, handshake).
 */
export type PreviewTokenClaims = {
  scope: string;
  scopeId: string;
};

export type HandshakeTokenClaims = {
  audience: string;
  expiry: number;
  jobId: string;
};

export type CurvenoteTokenClaims = {
  aud: string;
};

/**
 * return true if the strings match, ignoring any trailing slash
 */
export function slashInvariantMatch(maybeUrl1: string | undefined, maybeUrl2: string | undefined) {
  if (!maybeUrl1 || !maybeUrl2) return false;
  return maybeUrl1.replace(/\/$/, '') === maybeUrl2.replace(/\/$/, '');
}

export function decodeTokenPayload(token: string) {
  // peek inside the token
  const payload = jwt.decode(token.startsWith('Bearer ') ? token.slice(7) : token);
  // we expect an object
  if (!payload || typeof payload !== 'object' || !payload.aud || typeof payload.aud !== 'string') {
    throw error401('Invalid token (decode)');
  }
  return payload;
}

/**
 * Authorize curvenote user
 *
 * Validate the authorization token using the curvenote API,
 * and return the user information.
 *
 */
export async function authorizeCurvenoteUser(url: string, bearerToken: string) {
  // validate the token by recovering the user information
  // this is an authorized request specific to the user
  // TODO: caching!!!
  const api = url.replace(/\/$/, '');
  const resp = await fetch(`${api}/my/user`, {
    headers: { Authorization: bearerToken },
  });
  if (!resp.ok) {
    console.log('authorizeCurvenoteUser failed', resp.status, resp.statusText);
    throw error401('No user for token');
  }

  // take user information from the API repsonse
  const { id, email, name } = (await resp.json()) as { id: string; email: string; name: string };
  return { id, email, name };
}
