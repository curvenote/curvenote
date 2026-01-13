/**
 * JWT Integration Service
 *
 * This module provides JWT-based authentication for external service integration.
 * It implements RSA/RS256 JWT signing and verification using JSON Web Keys (JWK)
 * format, following industry standards for secure service-to-service communication.
 *
 * Key features:
 * - RSA/RS256 JWT token creation and verification
 * - JWK format for interoperability with external services
 * - JWKS endpoint support for automatic key discovery
 * - Flexible token expiry configuration
 * - Custom claims support for integration-specific data
 * - Key rotation support via 'kid' field
 *
 * External services can verify our tokens by:
 * 1. Fetching our public key from /v1/keys (JWKS endpoint)
 * 2. Using standard JWT libraries to verify token signatures
 * 3. Validating claims like issuer, audience, and expiry
 *
 * @see https://tools.ietf.org/html/rfc7517 - JSON Web Key (JWK) specification
 * @see https://tools.ietf.org/html/rfc7519 - JSON Web Token (JWT) specification
 */

import { SignJWT, jwtVerify, importJWK, type JWK } from 'jose';
import { randomUUID } from 'node:crypto';
import { error401 } from '@curvenote/scms-core';
import type { Context } from './context.server.js';

export interface IntegrationTokenClaims {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  jti: string;
  sub: string;
  // Custom claims for integration
  [key: string]: any;
}

/**
 * Parse human-readable duration string into seconds
 *
 * Supports common time units for JWT expiry configuration:
 * - 's' for seconds (e.g., "30s" = 30 seconds)
 * - 'm' for minutes (e.g., "5m" = 5 minutes)
 * - 'h' for hours (e.g., "2h" = 2 hours)
 * - 'd' for days (e.g., "7d" = 7 days)
 *
 * @param duration - Duration string like "1m", "30s", "2h", "7d"
 * @returns Duration in seconds
 * @throws Error if format is invalid
 *
 * @example
 * parseDuration("5m")  // returns 300 (5 minutes)
 * parseDuration("2h")  // returns 7200 (2 hours)
 * parseDuration("1d")  // returns 86400 (1 day)
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(
      `Invalid duration format: ${duration}. Use format like "1m", "1h", "30m", "2d"`,
    );
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };

  return value * multipliers[unit as keyof typeof multipliers];
}

/**
 * Creates a signed JWT token for external service integration
 *
 * This function generates a JWT token that can be used to authenticate with external services.
 * The token is signed using the private RSA key from the integration configuration and includes
 * standard JWT claims plus any custom claims provided.
 *
 * The issuer is automatically set from the configuration, allowing external services to verify
 * the token's authenticity by fetching the public key from the JWKS endpoint.
 *
 * @param ctx - Application context containing configuration
 * @param subject - The subject of the token (typically a service or user identifier)
 * @param audience - The intended recipient/audience for this token (e.g., external service URL)
 * @param options - Optional configuration
 * @param options.customClaims - Additional claims to include in the JWT payload
 * @param options.expiryOverride - Override default expiry (e.g., "5m", "1h", "2d")
 * @returns Promise resolving to a signed JWT string
 * @throws Error if integration configuration is missing or invalid
 *
 * @example
 * // Create a token for a webhook callback
 * const token = await createIntegrationToken(
 *   ctx,
 *   'user-123',
 *   'https://partner-service.com/webhook',
 *   {
 *     customClaims: { permissions: ['read', 'write'] },
 *     expiryOverride: '10m'
 *   }
 * );
 *
 * @example
 * // Create a simple token with default expiry
 * const token = await createIntegrationToken(
 *   ctx,
 *   'service-integration',
 *   'https://api.example.com'
 * );
 */
export async function createIntegrationToken(
  ctx: Context,
  subject: string,
  audience: string,
  options: {
    customClaims?: Record<string, any>;
    expiryOverride?: string; // Duration string like "2h", "30m"
  } = {},
): Promise<string> {
  const config = ctx.$config.api.integrations;

  if (!config) {
    throw new Error('Integration configuration not found');
  }

  const { issuer, tokenExpiryDuration, privateKey } = config;

  if (!privateKey || !issuer) {
    throw new Error('Integration private key or issuer not configured');
  }

  // Import the private key for signing
  const key = await importJWK(privateKey as JWK, 'RS256');

  // Calculate expiry - default to 1 minute
  const expiryDuration = options.expiryOverride || tokenExpiryDuration || '1m';
  const expirySeconds = parseDuration(expiryDuration);
  const now = Math.floor(Date.now() / 1000);

  // Generate unique token ID
  const jti = randomUUID();

  // Build claims
  const claims: IntegrationTokenClaims = {
    iss: issuer, // Issuer from config
    aud: audience, // Audience provided as parameter
    exp: now + expirySeconds,
    iat: now,
    jti,
    sub: subject,
    ...options.customClaims,
  };

  // Create and sign the JWT
  const jwt = new SignJWT(claims).setProtectedHeader({
    alg: 'RS256',
    typ: 'JWT',
    kid: privateKey.kid, // Key ID for key rotation support
  });

  return await jwt.sign(key);
}

/**
 * Verifies and decodes a JWT integration token
 *
 * This function validates a JWT token that was created by our createIntegrationToken function
 * or by external services using our public key. It verifies the signature, checks the issuer,
 * and optionally validates the audience claim.
 *
 * The verification process:
 * 1. Imports the public key from configuration
 * 2. Verifies the JWT signature using RSA/RS256
 * 3. Validates the issuer matches our configuration
 * 4. Optionally validates the audience if provided
 * 5. Checks token expiry and other standard claims
 *
 * @param ctx - Application context containing configuration
 * @param token - The JWT token string to verify
 * @param expectedAudience - Optional audience to validate against (if not provided, audience is not checked)
 * @returns Promise resolving to decoded token claims
 * @throws Error if token is invalid, expired, or verification fails
 *
 * @example
 * // Verify a token without audience check
 * const claims = await verifyIntegrationToken(ctx, jwtToken);
 * console.log('Token subject:', claims.sub);
 *
 * @example
 * // Verify a token with specific audience
 * const claims = await verifyIntegrationToken(
 *   ctx,
 *   jwtToken,
 *   'https://our-service.com/api'
 * );
 * console.log('Custom claims:', claims.permissions);
 */
export async function verifyIntegrationToken(
  ctx: Context,
  token: string,
  expectedAudience?: string,
): Promise<IntegrationTokenClaims> {
  const config = ctx.$config.api.integrations;

  if (!config) {
    throw new Error('Integration configuration not found');
  }

  const { issuer, publicKey } = config;

  if (!publicKey || !issuer) {
    throw new Error('Integration public key or issuer not configured');
  }

  try {
    // Import the public key for verification
    const key = await importJWK(publicKey as JWK, 'RS256');

    // Verify the token
    const verifyOptions: any = {
      issuer,
    };

    // Only verify audience if provided
    if (expectedAudience) {
      verifyOptions.audience = expectedAudience;
    }

    const { payload } = await jwtVerify(token, key, verifyOptions);

    return payload as IntegrationTokenClaims;
  } catch (err) {
    console.error('Invalid integration token', err);
    throw error401(
      'Invalid integration token: ' + (err instanceof Error ? err.message : 'Unknown error'),
    );
  }
}

/**
 * Retrieves the public key in JWK format for external services
 *
 * This function extracts the RSA public key from the integration configuration
 * and returns it in JSON Web Key (JWK) format. External services can use this
 * key to verify JWT tokens issued by our service.
 *
 * The returned JWK includes:
 * - kty: Key type (RSA)
 * - n: Public key modulus (base64url encoded)
 * - e: Public key exponent (typically "AQAB")
 * - use: Key usage ("sig" for signature)
 * - alg: Algorithm ("RS256")
 * - kid: Key identifier for rotation support
 *
 * @param ctx - Application context containing configuration
 * @returns JWK object representing the public key
 * @throws Error if integration configuration or public key is missing
 *
 * @example
 * const publicKey = getIntegrationPublicKey(ctx);
 * console.log('Key ID:', publicKey.kid);
 * console.log('Algorithm:', publicKey.alg);
 */
export function getIntegrationPublicKey(ctx: Context): JWK {
  const config = ctx.$config.api.integrations;

  if (!config?.publicKey) {
    throw new Error('Integration public key not configured');
  }

  return config.publicKey as JWK;
}

/**
 * Gets the JWKS (JSON Web Key Set) for external services
 *
 * This function returns a JWKS (JSON Web Key Set) document containing our public key(s)
 * in the standardized format defined by RFC 7517. This is the format expected by JWT
 * libraries and external services for automatic public key discovery.
 *
 * The JWKS format allows for:
 * - Multiple keys in a single response (useful during key rotation)
 * - Standardized key identification via 'kid' field
 * - Automatic key discovery by external services
 * - Caching and refresh strategies
 *
 * This function is typically used by the `/v1/keys` API endpoint to serve public keys
 * to external services that need to verify our JWT tokens.
 *
 * @param ctx - Application context containing configuration
 * @returns JWKS object with 'keys' array containing public key(s)
 * @throws Error if integration configuration is missing
 *
 * @example
 * const jwks = getIntegrationJWKS(ctx);
 * console.log('Number of keys:', jwks.keys.length);
 * console.log('First key ID:', jwks.keys[0].kid);
 *
 * // Example response format:
 * // {
 * //   "keys": [
 * //     {
 * //       "kty": "RSA",
 * //       "use": "sig",
 * //       "kid": "integration-key-2025-01",
 * //       "alg": "RS256",
 * //       "n": "...",
 * //       "e": "AQAB"
 * //     }
 * //   ]
 * // }
 */
export function getIntegrationJWKS(ctx: Context): { keys: JWK[] } {
  const publicKey = getIntegrationPublicKey(ctx);

  return {
    keys: [publicKey],
  };
}
