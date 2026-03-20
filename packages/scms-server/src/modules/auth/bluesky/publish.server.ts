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
