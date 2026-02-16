/**
 * Helpers to ensure extension admin config never exposes secrets to the client.
 * Used by extensions in getSafeAdminConfig and by the platform loader as defense in depth.
 */

export const OBFUSCATED_SECRET_PLACEHOLDER = '****************';

/**
 * Returns a fixed obfuscation string for secret values so the real value never reaches the client.
 * Use in getSafeAdminConfig for any key that may contain secrets.
 *
 * @param value - The value (presence is checked; value is never returned)
 * @returns Placeholder string (e.g. 16 stars) when value is truthy, empty string otherwise
 */
export function obfuscateSecret(value: unknown): string {
  if (value !== undefined && value !== null && value !== '') {
    return OBFUSCATED_SECRET_PLACEHOLDER;
  }
  return '';
}

/** Keys (case-insensitive) that are always obfuscated in extension admin config. */
const SECRET_KEY_NAMES = new Set(
  [
    'apiKey',
    'api_key',
    'password',
    'secret',
    'token',
    'privateKey',
    'private_key',
    'secretKeyfile',
    'clientSecret',
    'client_secret',
    'authToken',
    'auth_token',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
  ].map((k) => k.toLowerCase()),
);

function isSecretKey(key: string): boolean {
  return SECRET_KEY_NAMES.has(key.toLowerCase());
}

/**
 * Recursively sanitizes an object so any property whose key matches known secret names
 * has its value replaced with the obfuscation placeholder. Never send the return value
 * of getSafeAdminConfig to the client without running this first.
 *
 * @param obj - Object returned by an extension's getSafeAdminConfig (or similar)
 * @returns Deep copy with secret values obfuscated
 */
export function sanitizeExtensionAdminConfig(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = sanitizeExtensionAdminConfig(value as Record<string, unknown>);
    } else if (isSecretKey(key)) {
      out[key] = OBFUSCATED_SECRET_PLACEHOLDER;
    } else {
      out[key] = value;
    }
  }
  return out;
}
