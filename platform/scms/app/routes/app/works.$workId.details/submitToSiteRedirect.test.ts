/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, it } from 'vitest';
import { resolveSubmitRedirectTarget } from './submitToSiteRedirect';

describe('resolveSubmitRedirectTarget', () => {
  it('prefers redirectPath when provided', () => {
    expect(
      resolveSubmitRedirectTarget(
        {
          redirectPath: '/app/custom/destination',
          siteName: 'pmc',
          submissionVersionId: 'sv-1',
        },
        '/app',
      ),
    ).toBe('/app/custom/destination');
  });

  it('falls back to the constructed submission URL from siteName and submissionVersionId', () => {
    expect(
      resolveSubmitRedirectTarget({ siteName: 'pmc', submissionVersionId: 'sv-1' }, '/app'),
    ).toBe('/app/site/pmc/submission/sv-1');
  });

  it('returns undefined when no destination is provided', () => {
    expect(resolveSubmitRedirectTarget({}, '/app')).toBeUndefined();
    expect(resolveSubmitRedirectTarget({ siteName: 'pmc' }, '/app')).toBeUndefined();
    expect(resolveSubmitRedirectTarget({ submissionVersionId: 'sv-1' }, '/app')).toBeUndefined();
  });
});
