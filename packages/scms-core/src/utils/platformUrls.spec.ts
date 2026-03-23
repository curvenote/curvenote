// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  asPlatformMessageUrl,
  asSiteSubmissionUrl,
  asSiteWorkUrl,
  platformMessageAppPath,
  siteSubmissionAppPath,
  siteWorkAppPath,
} from './platformUrls.js';

const asBaseUrl = (path: string) => `https://app.example.com${path}`;

describe('platformUrls', () => {
  it('siteSubmissionAppPath', () => {
    expect(siteSubmissionAppPath('some-site', 'sub-1')).toBe(
      '/app/sites/some-site/submissions/sub-1',
    );
  });

  it('asSiteSubmissionUrl', () => {
    expect(asSiteSubmissionUrl(asBaseUrl, 'some-site', 'sub-1')).toBe(
      'https://app.example.com/app/sites/some-site/submissions/sub-1',
    );
  });

  it('platform message paths', () => {
    expect(platformMessageAppPath('m1')).toBe('/app/platform/messages/m1');
    expect(asPlatformMessageUrl(asBaseUrl, 'm1')).toBe(
      'https://app.example.com/app/platform/messages/m1',
    );
  });

  it('site work paths', () => {
    expect(siteWorkAppPath('w1')).toBe('/app/works/w1');
    expect(asSiteWorkUrl(asBaseUrl, 'some-site', 'w1')).toBe(
      'https://app.example.com/app/works/w1',
    );
  });
});
