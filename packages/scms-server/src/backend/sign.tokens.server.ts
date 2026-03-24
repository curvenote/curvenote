import jwt from 'jsonwebtoken';
import { error401 } from '@curvenote/scms-core';
import type { UserDBO } from './db.types.js';

export interface UserTokenClaims {
  iss: string;
  aud: string;
  cfg: string;
  exp?: number;
  sub: string;
  user_id: string;
  name?: string;
  note?: string;
  email?: string;
  email_verified?: boolean;
}

export interface SessionTokenClaims {
  iss: string;
  aud: string;
  cfg: string;
  exp: number;
  sub: string;
  user_id: string;
  name?: string;
  note?: string;
  email?: string;
  email_verified?: boolean;
}

export interface UnsubscribeTokenClaims {
  exp: number;
  iat: number;
  email: string;
}

export interface EmailVerificationTokenClaims {
  exp: number;
  iat: number;
  user_id: string;
  email: string;
}

export function createUserToken(
  user: UserDBO,
  tokenId: string,
  audience: string,
  issuer: string,
  description: string,
  configUrl: string,
  key: string,
  expiry?: number,
) {
  const claims: UserTokenClaims = {
    iss: issuer,
    aud: audience,
    cfg: configUrl,
    sub: `${user.id}/${tokenId}`,
    user_id: user.id,
    name: user.display_name ?? user.id,
    note: description,
    email: user.email ?? undefined,
    email_verified: user.email_verified ?? false,
  };

  if (expiry) {
    claims.exp = expiry;
  }

  return jwt.sign(claims, key, {
    algorithm: 'HS256',
  });
}

/**
 * Verifies a user token using the provided key, accepting any of the given issuers.
 * Pass a single issuer or multiple (e.g. primary + legacy domains in acceptedUserTokenIssuers).
 *
 * @param token - The JWT token to verify.
 * @param acceptedIssuers - Issuer URL(s) to accept (e.g. [userTokenIssuer, ...acceptedUserTokenIssuers]).
 * @param key - The secret key to verify the token.
 * @returns The decoded token claims if the token is valid.
 * @throws Will throw an error if the token is invalid or verification fails.
 */
export function verifyUserToken(
  token: string,
  acceptedIssuers: string[],
  key: string,
): UserTokenClaims {
  if (acceptedIssuers.length === 0) throw error401('No accepted user token issuers configured');
  try {
    const decoded = jwt.verify(token, key, { algorithms: ['HS256'] }) as UserTokenClaims;
    if (!decoded.iss || !acceptedIssuers.includes(decoded.iss)) {
      throw new Error(`Token issuer "${decoded.iss}" not in accepted list`);
    }
    return decoded;
  } catch (err) {
    console.error('Invalid user token', err);
    throw error401('Invalid user token: ' + err);
  }
}

/**
 * Creates a session token for a user.
 *
 * @param userId - The unique identifier of the user.
 * @param audience - The intended audience for the token.
 * @param issuer - The issuer of the token.
 * @param configUrl - The url where sessionconfiguration details can be retreived from.
 * @param key - The secret key used to sign the token.
 * @returns A signed JSON Web Token (JWT) as a string.
 */
export function createSessionToken(
  user: UserDBO,
  audience: string,
  issuer: string,
  description: string,
  configUrl: string,
  key: string,
) {
  const claims: SessionTokenClaims = {
    iss: issuer,
    aud: audience,
    cfg: configUrl,
    exp: Math.floor(Date.now() / 1000) + 60 * 15,
    sub: user.id,
    user_id: user.id,
    name: user.display_name ?? user.id,
    note: description,
    email: user.email ?? undefined,
    email_verified: user.email_verified ?? false,
  };

  return jwt.sign(claims, key, {
    algorithm: 'HS256',
  });
}

/**
 * Verifies the provided session token using the specified key.
 *
 * @param token - The session token to verify.
 * @param key - The secret key used to verify the token.
 * @returns The decoded session token claims if the token is valid.
 * @throws Will throw an error if the token is invalid or verification fails.
 */
export function verifySessionToken(token: string, key: string) {
  try {
    return jwt.verify(token, key, {
      algorithms: ['HS256'],
    }) as SessionTokenClaims;
  } catch (err) {
    console.error('Invalid session token', err);
    throw error401();
  }
}

/**
 * Creates a JWT token for email unsubscribe links
 * Uses HMAC signing for internal token verification
 */
export function createUnsubscribeToken(email: string, key: string, expiry?: number) {
  const now = Math.floor(Date.now() / 1000);
  const exp = expiry ?? now + 60 * 24 * 60 * 60; // 60 days default

  const claims: UnsubscribeTokenClaims = {
    exp,
    iat: now,
    email,
  };

  return jwt.sign(claims, key, { algorithm: 'HS256' });
}

export function verifyUnsubscribeToken(token: string, key: string) {
  try {
    return jwt.verify(token, key, { algorithms: ['HS256'] }) as UnsubscribeTokenClaims;
  } catch (err) {
    console.error('Invalid unsubscribe token', err);
    throw error401('Invalid unsubscribe token');
  }
}

/** 1 day default expiry for email verification links */
const EMAIL_VERIFICATION_EXPIRY_SECONDS = 60 * 60 * 24;

/**
 * When `api.resend.apiKey` is unset, verification JWTs still need an HMAC secret.
 * Non-production only: use this fallback so local/staging can sign and verify links
 * without configuring Resend. Production must set the real API key.
 */
export const DEV_EMAIL_VERIFICATION_JWT_SECRET = 'dev-email-verification-secret';

/**
 * Returns the key used to sign/verify email verification tokens.
 * Uses the Resend API key when configured (existing behavior); otherwise in
 * non-production returns {@link DEV_EMAIL_VERIFICATION_JWT_SECRET}.
 */
export function getEmailVerificationSigningKey(
  resendApiKey: string | undefined | null,
): string | undefined {
  if (resendApiKey) return resendApiKey;
  if (process.env.NODE_ENV !== 'production') {
    return DEV_EMAIL_VERIFICATION_JWT_SECRET;
  }
  return undefined;
}

/**
 * Creates a JWT token for email verification links.
 * Token expires in 1 day by default.
 */
export function createEmailVerificationToken(
  userId: string,
  email: string,
  key: string,
  expirySeconds: number = EMAIL_VERIFICATION_EXPIRY_SECONDS,
) {
  const now = Math.floor(Date.now() / 1000);
  const claims: EmailVerificationTokenClaims = {
    exp: now + expirySeconds,
    iat: now,
    user_id: userId,
    email,
  };
  return jwt.sign(claims, key, { algorithm: 'HS256' });
}

export function verifyEmailVerificationToken(token: string, key: string) {
  try {
    return jwt.verify(token, key, { algorithms: ['HS256'] }) as EmailVerificationTokenClaims;
  } catch (err) {
    console.error('Invalid email verification token', err);
    throw error401('Invalid or expired verification link');
  }
}
