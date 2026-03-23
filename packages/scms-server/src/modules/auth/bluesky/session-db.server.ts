/**
 * Persist and load Bluesky (atproto) OAuth session data in UserLinkedAccountSession.
 * Session shape matches NodeSavedSession: { tokenSet, dpopJwk }.
 */

import type { PrismaClient } from '@curvenote/scms-db';
import { getPrismaClient } from '../../../backend/prisma.server.js';
import { uuidv7 } from 'uuidv7';

export type BlueskySessionPayload = {
  tokenSet: Record<string, unknown>;
  dpopJwk: Record<string, unknown>;
  sub: string;
  iss?: string;
};

/**
 * Persist a Bluesky session for a linked account.
 * Deactivates any previous session for this linked account and inserts a new row.
 */
export async function persistBlueskySessionForLinkedAccount(
  linkedAccountId: string,
  sub: string,
  sessionData: { tokenSet: unknown; dpopJwk: unknown },
  iss?: string,
): Promise<void> {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();

  await prisma.$transaction(async (tx) => {
    const sessionTx = tx as PrismaClient;
    await sessionTx.userLinkedAccountSession.updateMany({
      where: { user_linked_account_id: linkedAccountId },
      data: { active: false, date_modified: now },
    });
    await sessionTx.userLinkedAccountSession.create({
      data: {
        id: uuidv7(),
        user_linked_account_id: linkedAccountId,
        sub,
        iss: iss ?? null,
        token_set: sessionData.tokenSet as object,
        dpop_jwk: sessionData.dpopJwk as object,
        active: true,
        date_created: now,
        date_modified: now,
      },
    });
  });
}

/**
 * Load the current (active) Bluesky session for a linked account.
 * Returns null if no active session exists.
 */
export async function getBlueskySessionForLinkedAccount(
  linkedAccountId: string,
): Promise<BlueskySessionPayload | null> {
  const prisma = await getPrismaClient();
  const row = await (prisma as PrismaClient).userLinkedAccountSession.findFirst({
    where: { user_linked_account_id: linkedAccountId, active: true },
    orderBy: { date_modified: 'desc' },
  });
  if (!row) return null;
  return {
    sub: row.sub,
    iss: row.iss ?? undefined,
    tokenSet: row.token_set as Record<string, unknown>,
    dpopJwk: row.dpop_jwk as Record<string, unknown>,
  };
}
