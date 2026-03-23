import type { Key } from '@atproto/jwk';

/**
 * `NodeOAuthClient` wraps state/session stores with `toDpopKeyStore`, which strips
 * `dpopKey` and passes `dpopJwk` (from `dpopKey.privateJwk`) to `set`. On `get`,
 * the underlying store must return `{ dpopJwk, ... }` again — the wrapper converts
 * back to `dpopKey`. When persisting from a raw `Session`, use
 * `dpopKey.privateJwk ?? dpopKey.jwk` so private material is not lost.
 */
export function extractDpopJwkForStorage(data: unknown): Record<string, unknown> {
  if (data === null || typeof data !== 'object') {
    throw new Error('OAuth state/session missing DPoP key material');
  }
  const o = data as Record<string, unknown>;
  if (o.dpopJwk && typeof o.dpopJwk === 'object' && !Array.isArray(o.dpopJwk)) {
    return { ...(o.dpopJwk as Record<string, unknown>) };
  }
  const dpopKey = o.dpopKey as Key | undefined;
  if (dpopKey) {
    const material = dpopKey.privateJwk ?? dpopKey.jwk;
    if (material) return { ...(material as Record<string, unknown>) };
  }
  throw new Error('OAuth state/session missing DPoP key material');
}
