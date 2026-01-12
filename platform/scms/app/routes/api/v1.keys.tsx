import type { Route } from './+types/v1.keys';
import { error405 } from '@curvenote/scms-core';
import { withContext, getIntegrationJWKS } from '@curvenote/scms-server';

/**
 * GET /v1/keys - JWKS endpoint for integration public keys
 *
 * This endpoint serves the JSON Web Key Set (JWKS) containing
 * the public keys that external services can use to verify
 * JWT tokens issued by our application.
 *
 * This is a public endpoint that doesn't require authentication,
 * following the standard JWKS endpoint pattern used by
 * OAuth2/OpenID Connect providers.
 *
 * Response format follows RFC 7517 (JSON Web Key Set format):
 * {
 *   "keys": [
 *     {
 *       "kty": "RSA",
 *       "use": "sig",
 *       "kid": "integration-key-2025-01",
 *       "alg": "RS256",
 *       "n": "...",
 *       "e": "AQAB"
 *     }
 *   ]
 * }
 */
export async function loader(args: Route.LoaderArgs) {
  const ctx = await withContext(args);
  try {
    const jwks = getIntegrationJWKS(ctx);

    return Response.json(jwks, {
      headers: {
        'Content-Type': 'application/json',
        // Cache for 1 hour but allow revalidation
        'Cache-Control': 'public, max-age=3600, must-revalidate',
        // Security headers
        'X-Content-Type-Options': 'nosniff',
        // CORS headers to allow cross-origin requests
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error serving JWKS:', error);

    // Return a generic error to avoid leaking configuration details
    return Response.json(
      {
        error: 'Unable to retrieve public keys',
        message: 'Service temporarily unavailable',
      },
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    );
  }
}

// Only allow GET requests
export function action() {
  throw error405();
}
