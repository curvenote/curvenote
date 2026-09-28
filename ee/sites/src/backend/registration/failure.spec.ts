// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { HORIZON_HOURS } from '../jobs/backoff.js';
import { describeDoiFailure } from './failure.js';

describe('describeDoiFailure', () => {
  it('shows Crossref rejection message folded under a readable summary', () => {
    const xsd = 'Error validating schema crossref5.3.1.xsd : Error: cvc-complex-type.2.4.a';
    expect(describeDoiFailure(xsd)).toEqual({
      summary: 'Crossref rejected the metadata. Fix the submission and retry.',
      detail: xsd,
    });
  });

  it('gives the rejection summary without details when Crossref gave no message', () => {
    expect(describeDoiFailure('crossref_rejected')).toEqual({
      summary: 'Crossref rejected the metadata. Fix the submission and retry.',
    });
  });

  it('sends rejected credentials to support', () => {
    expect(describeDoiFailure('site_credentials_rejected')).toEqual({
      summary:
        "Crossref didn't accept our credentials for this site. Contact Curvenote support, then retry.",
    });
  });

  it('explains the horizon for both the deposit and the result, in the hours the jobs wait', () => {
    const expected = {
      summary: `Crossref didn't confirm the registration within ${HORIZON_HOURS} hours. Retry to submit it again.`,
    };
    expect(describeDoiFailure('no_deposit_after_horizon')).toEqual(expected);
    expect(describeDoiFailure('no_result_after_horizon')).toEqual(expected);
  });

  it('explains a site that is no longer set up', () => {
    expect(describeDoiFailure('site_not_active')).toEqual({
      summary: 'DOIs are no longer set up for this site.',
    });
  });

  it('never shows an internal code', () => {
    const expected = {
      summary: "We couldn't submit the registration to Crossref. No DOI was registered.",
    };
    for (const code of ['internal_error', 'dispatch_failed', 'deposit_not_received', null]) {
      expect(describeDoiFailure(code)).toEqual(expected);
    }
  });
});
