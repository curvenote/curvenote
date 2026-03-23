/**
 * Postgres-backed OAuth authorization state for @atproto/oauth-client (PKCE + state).
 * Required for serverless: in-memory state is not shared across invocations.
 * Table `OAuthAuthorizationState` is generic; use `provider` to separate flows.
 */

import type { InternalStateData } from '@atproto/oauth-client';
import type { Prisma, PrismaClient } from '@curvenote/scms-db';
import { getPrismaClient } from '../../../backend/prisma.server.js';
import { extractDpopJwkForStorage } from './dpop-jwk-storage.server.js';

const STATE_TTL_MS = 60 * 60 * 1000;

/** AT Protocol (Bluesky) OAuth — value stored in `OAuthAuthorizationState.provider`. */
export const OAUTH_AUTHORIZATION_STATE_PROVIDER_ATPROTO = 'atproto' as const;

type SerializedInternalStateData = Omit<InternalStateData, 'dpopKey'> & {
  dpopJwk: Record<string, unknown>;
};

function serialize(data: unknown): SerializedInternalStateData {
  const d = data as InternalStateData;
  return {
    iss: d.iss,
    authMethod: d.authMethod,
    verifier: d.verifier,
    appState: d.appState,
    dpopJwk: extractDpopJwkForStorage(data),
  };
}

/**
 * Return the same shape `toDpopKeyStore` passes to `set` (`dpopJwk`, not `dpopKey`).
 * `NodeOAuthClient` wraps this store and converts `dpopJwk` → `dpopKey` on read.
 */
function restorePayloadForDpopWrapper(raw: unknown): unknown {
  const o = raw as SerializedInternalStateData;
  if (!o?.dpopJwk || typeof o.dpopJwk !== 'object' || Array.isArray(o.dpopJwk)) {
    throw new Error('OAuth authorization state payload missing valid dpopJwk');
  }
  return {
    iss: o.iss,
    authMethod: o.authMethod,
    verifier: o.verifier,
    appState: o.appState,
    dpopJwk: o.dpopJwk,
  };
}

export const oauthAuthorizationStateStore = {
  async set(key: string, value: unknown): Promise<void> {
    const prisma = (await getPrismaClient()) as PrismaClient;
    const now = Date.now();
    const data = serialize(value);
    const expiresAt = new Date(now + STATE_TTL_MS).toISOString();
    const payload = data as unknown as Prisma.InputJsonValue;
    await prisma.oAuthAuthorizationState.upsert({
      where: { state: key },
      create: {
        state: key,
        provider: OAUTH_AUTHORIZATION_STATE_PROVIDER_ATPROTO,
        payload,
        date_created: new Date(now).toISOString(),
        expires_at: expiresAt,
      },
      update: {
        payload,
        expires_at: expiresAt,
      },
    });
  },

  async get(key: string): Promise<unknown | undefined> {
    const prisma = (await getPrismaClient()) as PrismaClient;
    const row = await prisma.oAuthAuthorizationState.findFirst({
      where: {
        state: key,
        provider: OAUTH_AUTHORIZATION_STATE_PROVIDER_ATPROTO,
      },
    });
    if (!row) return undefined;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await prisma.oAuthAuthorizationState.deleteMany({
        where: { state: key, provider: OAUTH_AUTHORIZATION_STATE_PROVIDER_ATPROTO },
      });
      return undefined;
    }
    return restorePayloadForDpopWrapper(row.payload);
  },

  async del(key: string): Promise<void> {
    const prisma = (await getPrismaClient()) as PrismaClient;
    await prisma.oAuthAuthorizationState.deleteMany({
      where: { state: key, provider: OAUTH_AUTHORIZATION_STATE_PROVIDER_ATPROTO },
    });
  },
};
