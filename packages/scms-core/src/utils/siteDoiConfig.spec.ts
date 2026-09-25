// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { SITE_DOI_CONFIG_MODE, SITE_DOI_CONFIG_STATUS } from './siteDoiConfig.js';

describe('SiteDoiConfig constants', () => {
  test('mode matches the values documented on SiteDoiConfig.mode', () => {
    expect(Object.values(SITE_DOI_CONFIG_MODE)).toEqual(['CURVENOTE_PREFIX', 'CUSTOM_PREFIX']);
  });

  test('status matches the values documented on SiteDoiConfig.status', () => {
    expect(Object.values(SITE_DOI_CONFIG_STATUS)).toEqual(['PENDING_ROLE', 'ACTIVE']);
  });
});
