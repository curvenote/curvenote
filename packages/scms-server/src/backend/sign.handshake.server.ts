import jwt from 'jsonwebtoken';
import { error401 } from '@curvenote/scms-core';

interface SignHandshakeTokenClaims {
  iss: string;
  exp: number;
  aud?: string;
  jobId?: string;
  endpoint_scope?: string;
}

export type { SignHandshakeTokenClaims };

export function createHandshakeToken(
  jobId: string,
  audience: string,
  issuer: string,
  key: string,
  expiry?: number,
) {
  const claims: SignHandshakeTokenClaims = {
    iss: issuer,
    exp: expiry ?? Math.floor(Date.now() / 1000) + 60 * 60 * 1, // 1 hours
    aud: audience,
    jobId,
  };

  return jwt.sign(claims, key, {
    algorithm: 'HS256',
  });
}

/** Cron/internal endpoint token — carries endpoint_scope only (no aud/jobId). */
export function createScopedHandshakeToken(
  endpointScope: string,
  issuer: string,
  key: string,
  expiry?: number,
) {
  const claims: SignHandshakeTokenClaims = {
    iss: issuer,
    exp: expiry ?? Math.floor(Date.now() / 1000) + 60 * 60 * 1,
    endpoint_scope: endpointScope,
  };

  return jwt.sign(claims, key, {
    algorithm: 'HS256',
  });
}

export function verifyHandshakeToken(token: string, issuer: string, key: string) {
  try {
    return jwt.verify(token, key, {
      algorithms: ['HS256'],
      issuer,
    }) as SignHandshakeTokenClaims;
  } catch (err) {
    console.error('Invalid handshake token', err);
    throw error401();
  }
}
