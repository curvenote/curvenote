// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { SITE_DOI_CONFIG_STATUS, isSiteDoiConfigStatus } from './siteDoiConfig.js';

describe('SITE_DOI_CONFIG_STATUS', () => {
  test('matches the values documented on SiteDoiConfig.status', () => {
    expect(Object.values(SITE_DOI_CONFIG_STATUS)).toEqual([
      'PENDING_ROLE',
      'ACTIVE',
      'NEEDS_ATTENTION',
    ]);
  });

  test('isSiteDoiConfigStatus accepts known values only', () => {
    expect(isSiteDoiConfigStatus('ACTIVE')).toBe(true);
    expect(isSiteDoiConfigStatus('active')).toBe(false);
    expect(isSiteDoiConfigStatus(null)).toBe(false);
  });
});
