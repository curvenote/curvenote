/**
 * Fallback display names for auth providers when config does not provide displayName.
 * Used so provider keys (e.g. "github") render nicely (e.g. "GitHub") in toasts and UI.
 */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  orcid: 'ORCID',
  google: 'Google',
  github: 'GitHub',
  okta: 'Okta',
  firebase: 'Curvenote',
  'firebase-google': 'Firebase Google',
  'firebase-email': 'Firebase Email',
};

export type AuthProviderForDisplay = { provider: string; displayName?: string };

/**
 * Returns a human-readable display name for an auth provider key.
 * Uses auth provider config displayName when provided, otherwise a known fallback, then title-case.
 */
export function formatAuthProviderDisplayName(
  provider: string,
  authProviders?: readonly AuthProviderForDisplay[],
): string {
  if (authProviders?.length) {
    const authProvider = authProviders.find((p) => p.provider === provider.toLowerCase());
    if (authProvider?.displayName) {
      return authProvider.displayName;
    }
  }
  return (
    PROVIDER_DISPLAY_NAMES[provider.toLowerCase()] ||
    provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase()
  );
}
