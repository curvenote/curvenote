// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  computeCanResumeDraftUpload,
  isDraftVersionValidForReuse,
  isPmcWorkVersionMetadata,
  resolveResumeDraftUploadPath,
  resolveWorkVersionDoi,
} from './metadata.server';

describe('isDraftVersionValidForReuse', () => {
  it('returns true for any draft metadata shape', () => {
    expect(isDraftVersionValidForReuse(null)).toBe(true);
    expect(isDraftVersionValidForReuse({ checks: { enabled: [] } })).toBe(true);
    expect(isDraftVersionValidForReuse({})).toBe(true);
  });
});

describe('isPmcWorkVersionMetadata', () => {
  it('detects pmc object metadata', () => {
    expect(isPmcWorkVersionMetadata({ pmc: { title: 'x' } })).toBe(true);
    expect(isPmcWorkVersionMetadata({ checks: {} })).toBe(false);
    expect(isPmcWorkVersionMetadata({ pmc: null })).toBe(false);
  });
});

describe('resolveResumeDraftUploadPath', () => {
  it('routes PMC drafts to deposit when submission version id is present', () => {
    expect(
      resolveResumeDraftUploadPath({
        workId: 'work-1',
        workVersionId: 'wv-1',
        metadata: { pmc: {} },
        pmcSubmissionVersionId: 'sv-1',
      }),
    ).toBe('/app/works/work-1/site/pmc/deposit/sv-1');
  });

  it('routes article drafts to upload', () => {
    expect(
      resolveResumeDraftUploadPath({
        workId: 'work-1',
        workVersionId: 'wv-1',
        metadata: { checks: { enabled: [] } },
      }),
    ).toBe('/app/works/work-1/upload/wv-1?from=details');
  });

  it('falls back to upload when pmc metadata exists but no submission version id', () => {
    expect(
      resolveResumeDraftUploadPath({
        workId: 'work-1',
        workVersionId: 'wv-1',
        metadata: { pmc: {} },
      }),
    ).toBe('/app/works/work-1/upload/wv-1?from=details');
  });
});

describe('computeCanResumeDraftUpload', () => {
  it('allows resume when user can upload and latest version is draft', () => {
    expect(computeCanResumeDraftUpload(true, { draft: true }, {})).toBe(true);
  });

  it('denies resume when latest version is not draft', () => {
    expect(computeCanResumeDraftUpload(true, { draft: false }, {})).toBe(false);
  });
});

describe('resolveWorkVersionDoi', () => {
  it('prefers a non-empty version DOI', () => {
    expect(resolveWorkVersionDoi('10.1234/version', '10.1234/work')).toBe('10.1234/version');
  });

  it('falls back to work DOI when version DOI is empty or whitespace', () => {
    expect(resolveWorkVersionDoi('', '10.1234/work')).toBe('10.1234/work');
    expect(resolveWorkVersionDoi('   ', '10.1234/work')).toBe('10.1234/work');
  });

  it('falls back to work DOI when version DOI is null or undefined', () => {
    expect(resolveWorkVersionDoi(null, '10.1234/work')).toBe('10.1234/work');
    expect(resolveWorkVersionDoi(undefined, '10.1234/work')).toBe('10.1234/work');
  });

  it('returns null when both version and work DOI are unset or blank', () => {
    expect(resolveWorkVersionDoi('', null)).toBeNull();
    expect(resolveWorkVersionDoi('  ', ' ')).toBeNull();
    expect(resolveWorkVersionDoi(null, undefined)).toBeNull();
  });

  it('trims whitespace from the chosen DOI', () => {
    expect(resolveWorkVersionDoi('  10.1234/version  ', '10.1234/work')).toBe('10.1234/version');
    expect(resolveWorkVersionDoi('', '  10.1234/work  ')).toBe('10.1234/work');
  });
});
