/**
 * Postgres-backed session store for @atproto/oauth-client (refresh, fetchHandler).
 * Uses UserLinkedAccountSession with nullable user_linked_account_id until verify() links the account.
 */

import type { Session } from '@atproto/oauth-client';
import type { Prisma, PrismaClient } from '@curvenote/scms-db';
import { getPrismaClient } from '../../../backend/prisma.server.js';
import { uuidv7 } from 'uuidv7';
import { extractDpopJwkForStorage } from './dpop-jwk-storage.server.js';

const DEFAULT_AUTH_METHOD: Session['authMethod'] = { method: 'private_key_jwt', kid: 'key1' };

export const blueskyOAuthSessionStore = {
  async set(sub: string, session: unknown): Promise<void> {
    const s = session as Session;
    const prisma = (await getPrismaClient()) as PrismaClient;
    const now = new Date().toISOString();
    const tokenSet = s.tokenSet as Record<string, unknown>;
    const dpopJwk = extractDpopJwkForStorage(s);
    const authMethod = s.authMethod as object;

    await prisma.$transaction(async (tx) => {
      const t = tx as PrismaClient;
      await t.userLinkedAccountSession.updateMany({
        where: { sub, active: true },
        data: { active: false, date_modified: now },
      });
      await t.userLinkedAccountSession.create({
        data: {
          id: uuidv7(),
          user_linked_account_id: null,
          sub: s.tokenSet.sub,
          iss: (typeof tokenSet.iss === 'string' ? tokenSet.iss : null) ?? null,
          token_set: tokenSet as Prisma.InputJsonValue,
          dpop_jwk: dpopJwk as Prisma.InputJsonValue,
          auth_method: authMethod as Prisma.InputJsonValue,
          active: true,
          date_created: now,
          date_modified: now,
        },
      });
    });
  },

  async get(sub: string): Promise<unknown | undefined> {
    const prisma = (await getPrismaClient()) as PrismaClient;
    const row = await prisma.userLinkedAccountSession.findFirst({
      where: { sub, active: true },
      orderBy: { date_modified: 'desc' },
    });
    if (!row) return undefined;

    const authMethod = (row.auth_method as Session['authMethod'] | null) ?? DEFAULT_AUTH_METHOD;

    // Same shape as `toDpopKeyStore.set` — `NodeOAuthClient` wraps this store and
    // turns `dpopJwk` into `dpopKey` on read (do not return `dpopKey` here).
    return {
      dpopJwk: row.dpop_jwk as Record<string, unknown>,
      authMethod,
      tokenSet: row.token_set,
    } as unknown;
  },

  async del(sub: string): Promise<void> {
    const prisma = (await getPrismaClient()) as PrismaClient;
    const now = new Date().toISOString();
    await prisma.userLinkedAccountSession.updateMany({
      where: { sub, active: true },
      data: { active: false, date_modified: now },
    });
  },
};
