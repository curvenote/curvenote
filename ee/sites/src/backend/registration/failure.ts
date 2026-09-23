/**
 * Why a DOI registration failed, as stored in `DoiDeposit.error`. Kept free of server imports so
 * the DOI row's types and the timeline formatter can read it.
 */

/** Stored when Crossref rejected a deposit without saying why. */
export const CROSSREF_REJECTED = 'crossref_rejected';
