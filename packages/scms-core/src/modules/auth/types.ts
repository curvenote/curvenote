import type { FirebaseClientSideSafeOptions } from './firebase/types.js';
import type { GitHubClientSideSafeOptions } from './github/types.js';
import type { GoogleClientSideSafeOptions } from './google/types.js';
import type { OKTAClientSideSafeOptions } from './okta/types.js';
import type { ORCIDClientSideSafeOptions } from './orcid/types.js';
import type { BlueskyClientSideSafeOptions } from './bluesky/types.js';

export type AuthProvider = 'firebase' | 'google' | 'okta' | 'orcid' | 'github' | 'bluesky';

export type ClientSideSafeAuthOptions =
  | FirebaseClientSideSafeOptions
  | GitHubClientSideSafeOptions
  | GoogleClientSideSafeOptions
  | OKTAClientSideSafeOptions
  | ORCIDClientSideSafeOptions
  | BlueskyClientSideSafeOptions;
