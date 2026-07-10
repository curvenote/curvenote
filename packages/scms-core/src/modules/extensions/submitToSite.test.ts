// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { resolveSubmitToSiteExtension } from './submitToSite.js';
import type { ServerExtension } from './types.js';

function extension(partial: Partial<ServerExtension>): ServerExtension {
  return {
    id: partial.id ?? 'ext',
    name: partial.name ?? 'Extension',
    description: partial.description ?? 'Test extension',
    registerNavigation: partial.registerNavigation ?? (() => []),
    ...partial,
  };
}

describe('resolveSubmitToSiteExtension', () => {
  it('returns undefined when no extension operates the site', () => {
    const extensions = [
      extension({
        id: 'other',
        getOperatedSites: () => ['other-site'],
        submitToSite: async () => ({ success: true }),
      }),
    ];

    expect(resolveSubmitToSiteExtension(extensions, 'pmc')).toBeUndefined();
  });

  it('returns undefined when an extension operates the site but declares no submit handler', () => {
    const extensions = [
      extension({
        id: 'pmc',
        getOperatedSites: () => ['pmc'],
      }),
    ];

    expect(resolveSubmitToSiteExtension(extensions, 'pmc')).toBeUndefined();
  });

  it('returns the extension when it operates the site and declares submitToSite', () => {
    const pmc = extension({
      id: 'pmc',
      getOperatedSites: () => ['pmc'],
      submitToSite: async () => ({ success: true, submissionVersionId: 'sv-1' }),
    });
    const extensions = [pmc];

    expect(resolveSubmitToSiteExtension(extensions, 'pmc')).toBe(pmc);
  });

  it('returns the first matching extension when multiple declare the same site', () => {
    const first = extension({
      id: 'first',
      getOperatedSites: () => ['pmc'],
      submitToSite: async () => ({ success: true }),
    });
    const second = extension({
      id: 'second',
      getOperatedSites: () => ['pmc'],
      submitToSite: async () => ({ success: true }),
    });

    expect(resolveSubmitToSiteExtension([first, second], 'pmc')).toBe(first);
  });
});
