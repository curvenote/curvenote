/**
 * Why a DOI registration failed, as stored in `DoiDeposit.error`. Kept free of server imports so
 * the DOI row's types and the timeline formatter can read it.
 */

/** Stored when Crossref rejected a deposit without saying why. */
export const CROSSREF_REJECTED = 'crossref_rejected';

export type DoiFailureReason = {
  summary: string;
  /** Crossref's own words, shown folded: they are schema errors a site admin rarely needs. */
  detail?: string;
};

const REJECTED = 'Crossref rejected the metadata. Fix the submission and retry.';
const NOT_SUBMITTED = "We couldn't submit the registration to Crossref. No DOI was registered.";
const NO_ANSWER =
  "Crossref didn't confirm the registration within 72 hours. Retry to submit it again.";

/**
 * `DoiDeposit.error` holds either a code our jobs wrote or, for a rejection, Crossref's message.
 * Codes never reach the page: an unknown code would read as Crossref's message, so every code a
 * job writes is listed here.
 */
const BY_CODE: Record<string, DoiFailureReason> = {
  [CROSSREF_REJECTED]: { summary: REJECTED },
  site_credentials_rejected: {
    summary:
      "Crossref didn't accept our credentials for this site. Contact Curvenote support, then retry.",
  },
  no_deposit_after_72h: { summary: NO_ANSWER },
  no_result_after_72h: { summary: NO_ANSWER },
  site_not_active: { summary: 'DOIs are no longer set up for this site.' },
  internal_error: { summary: NOT_SUBMITTED },
  dispatch_failed: { summary: NOT_SUBMITTED },
  deposit_not_received: { summary: NOT_SUBMITTED },
};

export function describeDoiFailure(error: string | null): DoiFailureReason {
  if (!error) {
    return { summary: NOT_SUBMITTED };
  }
  return BY_CODE[error] ?? { summary: REJECTED, detail: error };
}
