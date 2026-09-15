// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { detectSocialKind, socialLinksError, SUPPORTED_SOCIAL_TEXT } from './SocialLinksField.js';

describe('detectSocialKind', () => {
  it.each([
    ['https://bsky.app/profile/x', 'bluesky'],
    ['https://twitter.com/SciPyConf', 'twitter'],
    ['https://x.com/SciPyConf', 'twitter'],
    ['https://www.linkedin.com/company/x', 'linkedin'],
    ['https://github.com/scipy-conference', 'github'],
    ['https://www.youtube.com/@x', 'youtube'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://myteam.slack.com', 'slack'],
    ['https://discord.gg/abc', 'discord'],
    ['https://discourse.example.org', 'discourse'],
    ['https://mastodon.social/@x', 'mastodon'],
    ['https://hachyderm.io/@x', 'mastodon'],
    ['mailto:hello@example.com', 'email'],
    ['MAILTO:HELLO@EXAMPLE.COM', 'email'],
  ])('%s → %s', (url, kind) => {
    expect(detectSocialKind(url)).toBe(kind);
  });

  it('ignores surrounding whitespace and a www. prefix', () => {
    expect(detectSocialKind('  https://www.github.com/x  ')).toBe('github');
  });

  it.each([
    ['an unknown host', 'https://example.com/us'],
    ['a bare word', 'github'],
    ['a non-http scheme', 'ftp://github.com/x'],
    ['an empty string', ''],
    ['only whitespace', '   '],
  ])('returns undefined for %s', (_label, url) => {
    expect(detectSocialKind(url)).toBeUndefined();
  });

  it('lists every recognised platform in the supported text', () => {
    for (const label of ['Bluesky', 'X (Twitter)', 'LinkedIn', 'GitHub', 'YouTube', 'Mastodon']) {
      expect(SUPPORTED_SOCIAL_TEXT).toContain(label);
    }
    expect(SUPPORTED_SOCIAL_TEXT).toMatch(/mailto/);
  });
});

describe('socialLinksError', () => {
  it('is undefined when every link has a url', () => {
    expect(
      socialLinksError([
        { kind: 'github', url: 'https://github.com/x' },
        { kind: 'website', url: 'https://example.com' },
      ]),
    ).toBeUndefined();
  });

  it('is undefined for no links', () => {
    expect(socialLinksError([])).toBeUndefined();
  });

  it('names the blank link by position', () => {
    expect(
      socialLinksError([
        { kind: 'github', url: 'https://github.com/x' },
        { kind: 'website', url: '' },
      ]),
    ).toBe('Social link 2 needs a link.');
  });

  it('treats whitespace as blank', () => {
    expect(socialLinksError([{ kind: 'website', url: '   ' }])).toBe('Social link 1 needs a link.');
  });
});
