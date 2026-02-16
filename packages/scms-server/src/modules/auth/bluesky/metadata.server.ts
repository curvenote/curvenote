import type { BlueskyProviderConfig } from './types.js';

/**
 * Build the atproto client metadata JSON to be served at clientId URL.
 * Used by the platform route that serves GET .../auth/bluesky/client-metadata.json
 */
export function getBlueskyClientMetadata(config: BlueskyProviderConfig): Record<string, unknown> {
  const baseUrl = config.clientId.replace(/\/[^/]*$/, '');
  const jwksUri = config.jwksUri ?? `${baseUrl}/jwks.json`;
  return {
    client_id: config.clientId,
    application_type: 'web',
    client_name: config.displayName ?? 'Bluesky',
    client_uri: baseUrl,
    redirect_uris: [config.redirectUrl],
    grant_types: ['authorization_code', 'refresh_token'],
    scope: 'atproto',
    response_types: ['code'],
    dpop_bound_access_tokens: true,
    token_endpoint_auth_method: 'private_key_jwt',
    token_endpoint_auth_signing_alg: 'RS256',
    jwks_uri: config.privateKeyPem ? jwksUri : undefined,
  };
}
