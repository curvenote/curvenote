import { httpError } from '@curvenote/scms-core';
import { getPrismaClient } from '../../../backend/prisma.server.js';
import { getBlueskySessionForLinkedAccount } from './session-db.server.js';

/**
 * Atproto/Bluesky publish and unpublish stubs.
 * When a site is configured with backend type "atproto", PUBLISH/UNPUBLISH jobs
 * call these instead of the CDN storage flow.
 *
 * TODO: Implement actual writing to the user's PDS using the nominated user's
 * Bluesky session (load via getBlueskySessionForLinkedAccount, restore session,
 * then use atproto client to create/delete records).
 */

export type AtprotoPublishParams = {
  siteId: string;
  nominatedUserLinkedAccountId: string;
  submissionVersionId: string;
  /** Additional context for the eventual implementation */
  payload: Record<string, unknown>;
};

export type AtprotoUnpublishParams = {
  siteId: string;
  nominatedUserLinkedAccountId: string;
  submissionVersionId: string;
  payload: Record<string, unknown>;
};

const ATPROTO_SITE_USER_REQUIRED_ERROR =
  'AT Protocol publishing requires a single nominated Bluesky user with an active session on this site.';

/**
 * Validate that AT Protocol publishing is configured with one valid Bluesky user
 * who is a member of the site and has an active persisted session.
 */
export async function assertAtprotoPublishingUser(params: {
  siteId: string;
  nominatedUserLinkedAccountId: string;
}): Promise<string> {
  const linkedAccountId = params.nominatedUserLinkedAccountId.trim();
  if (!linkedAccountId) {
    throw httpError(422, ATPROTO_SITE_USER_REQUIRED_ERROR);
  }

  const prisma = await getPrismaClient();
  const linkedAccount = await prisma.userLinkedAccount.findUnique({
    where: { id: linkedAccountId },
    select: { id: true, user_id: true, provider: true, pending: true },
  });
  if (!linkedAccount || linkedAccount.provider !== 'bluesky' || linkedAccount.pending) {
    throw httpError(422, ATPROTO_SITE_USER_REQUIRED_ERROR);
  }

  const siteMembership = await prisma.siteUser.findFirst({
    where: { site_id: params.siteId, user_id: linkedAccount.user_id },
    select: { id: true },
  });
  if (!siteMembership) {
    throw httpError(422, ATPROTO_SITE_USER_REQUIRED_ERROR);
  }

  const activeSession = await getBlueskySessionForLinkedAccount(linkedAccountId);
  if (!activeSession) {
    throw httpError(422, ATPROTO_SITE_USER_REQUIRED_ERROR);
  }

  return linkedAccountId;
}

/**
 * Stub: publish to atproto using the nominated user's Bluesky session.
 * TODO: Load session, restore atproto client, write records to PDS.
 */
export async function publishToAtproto(_params: AtprotoPublishParams): Promise<void> {
  // TODO: Implement actual atproto publish (write to user's PDS using session).
  console.log('[bluesky/publish] publishToAtproto called (not yet implemented)', _params.siteId);
}

/**
 * Stub: unpublish from atproto (remove or hide records).
 * TODO: Load session, restore atproto client, delete/update records on PDS.
 */
export async function unpublishFromAtproto(_params: AtprotoUnpublishParams): Promise<void> {
  // TODO: Implement actual atproto unpublish using session.
  console.log('[bluesky/publish] unpublishFromAtproto called (not yet implemented)', _params.siteId);
}
