import { createCipheriv, randomBytes, createDecipheriv } from 'node:crypto';
import { serialize } from 'cookie';

export const MAX_AGE = 60 * 60 * 24 * 7 * 4;

const IV_LENGTH = 16;

export function encryptJSON(secret: string, payload: Record<string, any>): string {
  const encryptionKey = Buffer.alloc(32, secret, 'utf8'); // pad / trim to 32 bytes
  const jsonString = JSON.stringify(payload);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-cbc', encryptionKey, iv);
  let encrypted = cipher.update(jsonString, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Function to decrypt a JSON payload
export function decryptJSON(secret: string, encryptedPayload: string): Record<string, any> {
  const encryptionKey = Buffer.alloc(32, secret, 'utf8'); // pad / trim to 32 bytes
  const [ivHex, encrypted] = encryptedPayload.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', encryptionKey, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

export function getSetEncryptedCookie(
  secret: string,
  name: string,
  value: Record<string, any>,
  opts?: { maxAge?: number; path?: string; sameSite?: 'strict' | 'lax' | 'none' },
): string {
  const encryptedValue = encryptJSON(secret, value);

  const cookie = serialize(name, encryptedValue, {
    httpOnly: true, // Ensures the cookie is not accessible via client-side JS
    secure: process.env.NODE_ENV === 'production', // Send only over HTTPS
    maxAge: opts?.maxAge ?? MAX_AGE, // 4 week expiration
    path: opts?.path ?? '/', // Cookie is valid for all paths
    sameSite: opts?.sameSite ?? 'strict', // Protects against
  });

  return cookie;
}

export function getInvalidateEncryptedCookie(
  name: string,
  opts?: { path?: string; sameSite?: 'strict' | 'lax' | 'none' },
) {
  const cookie = serialize(name, 'invalidated', {
    httpOnly: true, // Ensures the cookie is not accessible via client-side JS
    secure: process.env.NODE_ENV === 'production', // Send only over HTTPS
    maxAge: -1, // 4 week expiration
    path: opts?.path ?? '/', // Cookie is valid for all paths
    sameSite: opts?.sameSite ?? 'strict', // Protects against
  });

  return cookie;
}

export function getSetProviderCookie(secret: string, provider: string, data: Record<string, any>) {
  return getSetEncryptedCookie(secret, `__provider-${provider}`, data, { sameSite: 'lax' });
}

export function getInvalidateProviderCookie(provider: string) {
  return getInvalidateEncryptedCookie(`__provider-${provider}`, { sameSite: 'lax' });
}

/**
 * Returns Set-Cookie header values to clear all remix-auth-oauth2 cookies (oauth2:<uuid>) from the request.
 * These cookies are created by OAuth2Strategy and must be cleared on logout to avoid leaving stale OAuth state.
 */
export function getInvalidateOAuth2Cookies(cookieHeader: string | null): string[] {
  if (!cookieHeader?.trim()) return [];
  const pairs = cookieHeader.split(';').map((s) => s.trim());
  const toClear: string[] = [];
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    if (name.startsWith('oauth2:')) {
      toClear.push(
        serialize(name, '', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 0,
          path: '/',
          sameSite: 'lax',
        }),
      );
    }
  }
  return toClear;
}
