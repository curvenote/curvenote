import type { DoiFailure } from './types.js';

export const DOI_ERRORS = {
  stale: 'Configuration changed, reload the page.',
  forbidden: 'Only a Curvenote system admin can do this.',
  customDisabled: 'Own DOI prefix is not enabled for this Site.',
  prefixFormat: 'Enter a DOI prefix such as 10.1234',
  prefixIsCurvenote: "This is Curvenote's prefix. Choose Curvenote-managed registration instead.",
  prefixNotFound: 'Prefix not found at Crossref.',
  crossrefUnavailable: 'Crossref is unavailable, try again later. Nothing was saved.',
  roleFormat: 'Enter the Crossref role: letters, numbers, dashes or underscores.',
  roleRejected: 'Crossref rejected this role. Nothing was saved.',
  systemCredentials: "Curvenote's Crossref credentials failed. Nothing was saved.",
  pairTaken: 'This prefix and role are already linked to another Site. Nothing was saved.',
  hasRegistrations:
    'This Site has DOIs registered or being registered, so its DOI setup cannot be unlinked or reset. Nothing was saved.',
  unknownKind:
    'A Submission Kind on this page no longer exists. Reload the page. Nothing was saved.',
} as const;

/** Another request changed or removed the row since the page loaded. */
export const STALE: DoiFailure = { ok: false, status: 409, error: DOI_ERRORS.stale };

export function kindLocked(title: string): DoiFailure {
  return {
    ok: false,
    status: 409,
    error: `"${title}" has DOIs registered or being registered, so its DOI content type cannot change. Nothing was saved.`,
  };
}

/** Thrown inside a `commitDoiWrite` transaction to roll it back and answer with `failure`. */
export class DoiWriteRefused extends Error {
  constructor(readonly failure: DoiFailure) {
    super(failure.error);
    this.name = 'DoiWriteRefused';
  }
}
