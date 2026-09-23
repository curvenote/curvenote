// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { doiRowRefreshKey } from './doiRowRefresh.js';

const doi = 'd';

describe('doiRowRefreshKey', () => {
  it('has a key only while the registration is in progress, one per phase', () => {
    expect(doiRowRefreshKey({ status: 'SUBMITTING', doi, phase: 'sending', retried: false })).toBe(
      'SUBMITTING:sending',
    );
    expect(doiRowRefreshKey({ status: 'SUBMITTING', doi, phase: 'waiting', retried: true })).toBe(
      'SUBMITTING:waiting',
    );
  });

  it('never polls for a settled registration or none at all', () => {
    expect(doiRowRefreshKey({ status: 'REGISTERED', doi })).toBeNull();
    expect(doiRowRefreshKey({ status: 'FAILED', doi, reason: { summary: 'x' } })).toBeNull();
    expect(doiRowRefreshKey(null)).toBeNull();
  });
});
