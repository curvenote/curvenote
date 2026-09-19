import { CrossrefError, checkRole, lookupPrefix } from '../crossref/client.server.js';
import { normalizePrefix } from '../crossref/prefix.js';
import { DOI_ERRORS } from './errors.js';
import type { DoiDeps, DoiFailure } from './types.js';

/** Crossref roles are short ASCII tokens; permissive on purpose. */
export const ROLE_RE = /^[A-Za-z0-9_-]{1,64}$/;

export async function lookupOwner(
  deps: DoiDeps,
  prefix: string,
): Promise<{ ok: true; ownerName: string } | DoiFailure> {
  try {
    const found = await lookupPrefix(prefix, {
      fetch: deps.fetch,
      contactEmail: deps.creds.depositorEmail,
    });
    if (!found) {
      return { ok: false, status: 400, error: DOI_ERRORS.prefixNotFound };
    }
    return { ok: true, ownerName: found.ownerName };
  } catch (e) {
    if (e instanceof CrossrefError) {
      return { ok: false, status: 502, error: DOI_ERRORS.crossrefUnavailable };
    }
    throw e;
  }
}

/** What a customer typed, to a prefix we can store: format, not Curvenote's, known to Crossref. */
export async function resolveCustomPrefix(
  deps: DoiDeps,
  raw: string,
): Promise<{ ok: true; prefix: string; ownerName: string } | DoiFailure> {
  const prefix = normalizePrefix(raw);
  if (!prefix) {
    return { ok: false, status: 400, error: DOI_ERRORS.prefixFormat };
  }
  if (prefix === deps.creds.prefix) {
    return { ok: false, status: 400, error: DOI_ERRORS.prefixIsCurvenote };
  }
  const owner = await lookupOwner(deps, prefix);
  if (!owner.ok) {
    return owner;
  }
  return { ok: true, prefix, ownerName: owner.ownerName };
}

/**
 * One submissionDownload login as <depositorEmail>/<role>. On a 401 Crossref does not say whether
 * the role or the shared password is wrong, so we log in once more with Curvenote's own role:
 * if that fails too, the system password is the problem, not this role.
 */
export async function validateRole(
  deps: DoiDeps,
  role: string,
): Promise<{ ok: true } | DoiFailure> {
  if (!ROLE_RE.test(role)) {
    return { ok: false, status: 400, error: DOI_ERRORS.roleFormat };
  }
  try {
    const candidate = await checkRole(deps.creds, role, { fetch: deps.fetch });
    if (candidate.authenticated) {
      return { ok: true };
    }
    const control = await checkRole(deps.creds, deps.creds.role, { fetch: deps.fetch });
    if (control.authenticated) {
      return { ok: false, status: 400, error: DOI_ERRORS.roleRejected };
    }
    console.error('[doi] Crossref rejected the control login: check api.crossref.password');
    return { ok: false, status: 502, error: DOI_ERRORS.systemCredentials };
  } catch (e) {
    if (e instanceof CrossrefError) {
      return { ok: false, status: 502, error: DOI_ERRORS.crossrefUnavailable };
    }
    throw e;
  }
}
