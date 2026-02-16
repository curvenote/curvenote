export interface BlueskyProfile {
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

export interface BlueskyClientSideSafeOptions {
  provider: 'bluesky';
  displayName?: string;
  allowLinking?: boolean;
  provisionNewUser?: boolean;
  allowLogin?: boolean;
  adminLogin?: boolean;
}
