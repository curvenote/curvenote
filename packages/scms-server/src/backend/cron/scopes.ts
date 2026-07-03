import {
  CronEndpointScopes,
  type CronEndpointScope,
  cronEndpointScope,
  error401,
} from '@curvenote/scms-core';
import { type SignHandshakeTokenClaims, verifyHandshakeToken } from '../sign.handshake.server.js';

export { CronEndpointScopes, type CronEndpointScope, cronEndpointScope };

export type CronHandshakeConfig = {
  api: {
    handshakeIssuer: string;
    handshakeSigningSecret: string;
  };
};

export function assertEndpointScope(
  claims: SignHandshakeTokenClaims | undefined,
  expected: string,
): void {
  if (claims?.endpoint_scope !== expected) {
    throw error401('Invalid endpoint scope');
  }
}

function parseBearerToken(authHeader: string | null): string | undefined {
  if (!authHeader) return undefined;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return (match?.[1] ?? authHeader).trim() || undefined;
}

/**
 * Lightweight auth for cron callback routes — verify signature/issuer then assert endpoint_scope.
 * Does NOT use Context or decodeTokenPayload (scoped tokens omit aud).
 */
export function verifyEndpointScopedHandshake(
  authHeader: string | null,
  config: CronHandshakeConfig,
  expected: CronEndpointScope | string,
): SignHandshakeTokenClaims {
  const token = parseBearerToken(authHeader);
  if (!token) {
    throw error401('Missing bearer token');
  }

  const claims = verifyHandshakeToken(
    token,
    config.api.handshakeIssuer,
    config.api.handshakeSigningSecret,
  );
  assertEndpointScope(claims, expected);
  return claims;
}
