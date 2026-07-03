import { error401 } from '@curvenote/scms-core';
import { type HandshakeTokenClaims, verifyHandshakeToken } from '../sign.handshake.server.js';

export type CronHandshakeConfig = {
  api: {
    handshakeIssuer: string;
    handshakeSigningSecret: string;
  };
};

/** Built-in cron callback endpoint scopes ({METHOD}:{path}). */
export const CronEndpointScopes = {
  JOB_QUEUE_DRAIN: 'POST:/v1/jobs/push-to-drain',
  PROMOTE_SCHEDULED: 'POST:/v1/jobs/promote-scheduled',
  TEXT_INTEGRITY_RETRY_SWEEP: 'POST:/v1/hooks/text-integrity/retry-sweep',
} as const;

export type CronEndpointScope = (typeof CronEndpointScopes)[keyof typeof CronEndpointScopes];

export function cronEndpointScope(method: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${method.toUpperCase()}:${normalizedPath.split('?')[0]}`;
}

export function assertEndpointScope(
  claims: HandshakeTokenClaims | undefined,
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
): HandshakeTokenClaims {
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
