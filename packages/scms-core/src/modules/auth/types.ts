import type { FirebaseClientSideSafeOptions } from './firebase/types.js';
import type { GoogleClientSideSafeOptions } from './google/types.js';
import type { OKTAClientSideSafeOptions } from './okta/types.js';
import type { ORCIDClientSideSafeOptions } from './orcid/types.js';
import type { BlueskyClientSideSafeOptions } from './bluesky/types.js';

export type AuthProvider = 'firebase' | 'google' | 'okta' | 'orcid' | 'bluesky';

export type ClientSideSafeAuthOptions =
  | FirebaseClientSideSafeOptions
  | GoogleClientSideSafeOptions
  | OKTAClientSideSafeOptions
  | ORCIDClientSideSafeOptions
  | BlueskyClientSideSafeOptions;
