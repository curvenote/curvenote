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
 * Codes never reach the page: an unknown code would read as Crossref's message, so this table is
 * the list of codes itself and `DoiFailureCode` is derived from it.
 */
const BY_CODE = {
  [CROSSREF_REJECTED]: { summary: REJECTED },
  site_credentials_rejected: {
    summary:
      "Crossref didn't accept our credentials for this site. Contact Curvenote support, then retry.",
  },
  no_deposit_after_horizon: { summary: NO_ANSWER },
  no_result_after_horizon: { summary: NO_ANSWER },
  site_not_active: { summary: 'DOIs are no longer set up for this site.' },
  internal_error: { summary: NOT_SUBMITTED },
  dispatch_failed: { summary: NOT_SUBMITTED },
  deposit_not_received: { summary: NOT_SUBMITTED },
} satisfies Record<string, DoiFailureReason>;

/**
 * Every code our jobs write to `DoiDeposit.error`, as opposed to Crossref's own rejection message
 * (a free-form string `describeDoiFailure` also has to accept). Typing `failDeposit`'s input on
 * this union turns a code without readable copy into a `tsc` error instead of a silent "Crossref
 * rejected the metadata" for our own internal failure.
 */
export type DoiFailureCode = keyof typeof BY_CODE;

/** Looked up by an arbitrary stored string, not just a known `DoiFailureCode`: Crossref's own
 * rejection messages land here too, and must miss the lookup rather than index into it. */
const lookup = BY_CODE as Partial<Record<string, DoiFailureReason>>;

export function describeDoiFailure(error: string | null): DoiFailureReason {
  if (!error) {
    return { summary: NOT_SUBMITTED };
  }
  return lookup[error] ?? { summary: REJECTED, detail: error };
}
