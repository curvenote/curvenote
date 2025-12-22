export enum SiteTrackEvent {
  // Site events
  SITE_VIEWED = 'Site Viewed',
  SITE_ROLE_GRANTED = 'Site Role Granted',
  SITE_ROLE_REVOKED = 'Site Role Revoked',
  SITE_COLLECTION_CREATED = 'Site Collection Created',
  SITE_COLLECTION_DELETED = 'Site Collection Deleted',
}

export const SiteTrackEventDescriptions: Record<SiteTrackEvent, string> = {
  [SiteTrackEvent.SITE_VIEWED]: 'Site page viewed',
  [SiteTrackEvent.SITE_ROLE_GRANTED]: 'User role granted on a site',
  [SiteTrackEvent.SITE_ROLE_REVOKED]: 'User role revoked from a site',
  [SiteTrackEvent.SITE_COLLECTION_CREATED]: 'New collection created on a site',
  [SiteTrackEvent.SITE_COLLECTION_DELETED]: 'Collection deleted from a site',
};
