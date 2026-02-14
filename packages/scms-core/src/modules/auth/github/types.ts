export interface GitHubClientSideSafeOptions {
  provider: 'github';
  displayName?: string;
  allowLogin?: boolean;
  allowLinking?: boolean;
  provisionNewUser?: boolean;
  adminLogin?: boolean;
}

/** Profile shape from GitHub API /user (subset used in linked accounts). */
export interface GitHubProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}
