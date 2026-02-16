/**
 * Bluesky/atproto profile shape stored in linked account.
 */
export interface BlueskyProfile {
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

export interface BlueskyProviderConfig {
  clientId: string;
  redirectUrl: string;
  jwksUri?: string;
  privateKeyPem?: string;
  displayName?: string;
  allowLogin?: boolean;
  provisionNewUser?: boolean;
  allowLinking?: boolean;
  adminLogin?: boolean;
  pdsHostname?: string;
}
