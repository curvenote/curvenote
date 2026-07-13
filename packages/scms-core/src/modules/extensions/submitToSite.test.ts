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

  it('returns undefined when submitToSite is declared without getOperatedSites', () => {
    const extensions = [
      extension({
        id: 'pmc',
        submitToSite: async () => ({ success: true }),
      }),
    ];

    expect(resolveSubmitToSiteExtension(extensions, 'pmc')).toBeUndefined();
  });

  it('returns undefined when getOperatedSites returns null or undefined', () => {
    const extensions = [
      extension({
        id: 'null-sites',
        getOperatedSites: () => null as unknown as string[],
        submitToSite: async () => ({ success: true }),
      }),
      extension({
        id: 'undefined-sites',
        getOperatedSites: () => undefined as unknown as string[],
        submitToSite: async () => ({ success: true }),
      }),
    ];

    expect(resolveSubmitToSiteExtension(extensions, 'pmc')).toBeUndefined();
  });

  it('does not throw when scanning extensions with missing or empty operated sites', () => {
    const extensions = [
      extension({
        id: 'no-operated-sites',
        submitToSite: async () => ({ success: true }),
      }),
      extension({
        id: 'empty-operated-sites',
        getOperatedSites: () => [],
        submitToSite: async () => ({ success: true }),
      }),
      extension({
        id: 'pmc',
        getOperatedSites: () => ['pmc'],
        submitToSite: async () => ({ success: true, submissionVersionId: 'sv-1' }),
      }),
    ];

    expect(() => resolveSubmitToSiteExtension(extensions, 'pmc')).not.toThrow();
    expect(resolveSubmitToSiteExtension(extensions, 'pmc')?.id).toBe('pmc');
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
