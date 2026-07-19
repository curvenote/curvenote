import { timingSafeEqual } from 'node:crypto';

/** Constant-time comparison for Bearer secrets of equal encoding length. */
export function verifyBearerSecret(authHeader: string | null, expectedSecret: string): boolean {
  if (!authHeader || !expectedSecret) return false;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const received = (match?.[1] ?? authHeader).trim();
  const expected = expectedSecret.trim();
  if (!received || received.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  } catch {
    return false;
  }
}
