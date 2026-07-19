export enum SiteTrackEvent {
  // Site events
  SITE_VIEWED = 'Site Viewed',
  SITE_ROLE_GRANTED = 'Site Role Granted',
  SITE_ROLE_REVOKED = 'Site Role Revoked',
  SITE_COLLECTION_CREATED = 'Site Collection Created',
  SITE_COLLECTION_DELETED = 'Site Collection Deleted',
  SITE_SERVICE_ACCOUNT_CREATED = 'Site Service Account Created',
  SITE_SERVICE_ACCOUNT_DELETED = 'Site Service Account Deleted',
  SITE_SERVICE_ACCOUNT_TOKEN_CREATED = 'Site Service Account Token Created',
  SITE_SERVICE_ACCOUNT_TOKEN_DELETED = 'Site Service Account Token Deleted',
}

export const SiteTrackEventDescriptions: Record<SiteTrackEvent, string> = {
  [SiteTrackEvent.SITE_VIEWED]: 'Site page viewed',
  [SiteTrackEvent.SITE_ROLE_GRANTED]: 'User role granted on a site',
  [SiteTrackEvent.SITE_ROLE_REVOKED]: 'User role revoked from a site',
  [SiteTrackEvent.SITE_COLLECTION_CREATED]: 'New collection created on a site',
  [SiteTrackEvent.SITE_COLLECTION_DELETED]: 'Collection deleted from a site',
  [SiteTrackEvent.SITE_SERVICE_ACCOUNT_CREATED]: 'Site service account created',
  [SiteTrackEvent.SITE_SERVICE_ACCOUNT_DELETED]: 'Site service account deleted',
  [SiteTrackEvent.SITE_SERVICE_ACCOUNT_TOKEN_CREATED]: 'Token created for a site service account',
  [SiteTrackEvent.SITE_SERVICE_ACCOUNT_TOKEN_DELETED]: 'Token deleted for a site service account',
};
