import jwt from 'jsonwebtoken';
import { error401 } from '@curvenote/scms-core';

interface HandshakeTokenClaims {
  iss: string;
  exp: number;
  aud: string;
  jobId: string;
}

export function createHandshakeToken(
  jobId: string,
  audience: string,
  issuer: string,
  key: string,
  expiry?: number,
) {
  const claims: HandshakeTokenClaims = {
    iss: issuer,
    exp: expiry ?? Math.floor(Date.now() / 1000) + 60 * 60 * 4, // 4 hours
    aud: audience,
    jobId,
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
    }) as HandshakeTokenClaims;
  } catch (err) {
    console.error('Invalid handshake token', err);
    throw error401();
  }
}
