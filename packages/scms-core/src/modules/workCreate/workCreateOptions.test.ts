// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi } from 'vitest';
import type { ClientExtension, ServerExtension, WorkCreateOption } from '../extensions/types.js';
import {
  BUILTIN_ARTICLE_WORK_CREATE_OPTION,
  BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID,
} from './builtinArticleOption.js';
import {
  getAllRegisteredWorkCreateOptions,
  getAvailableWorkCreateOptions,
  getExtensionWorkCreateOptions,
  invokeExtensionCreateWorkVersion,
  resolveCreateNewVersionOption,
} from './workCreateOptions.js';
import { resolveWorkCreateOptionFromMetadata } from './resolveWorkCreateOption.js';

const pmcOption: WorkCreateOption = {
  id: 'pmc-deposit',
  label: 'PMC Deposit',
  metadataKey: 'pmc',
  startPath: '/app/works/pmc',
  mode: 'standalone',
  extensionId: 'pmc',
};

const mockExtensions: ClientExtension[] = [
  {
    id: 'pmc',
    name: 'PMC',
    description: 'PMC',
    registerNavigation: () => [],
    getWorkCreateOptions: () => [
      {
        id: 'pmc-deposit',
        label: 'PMC Deposit',
        metadataKey: 'pmc',
        startPath: '/app/works/pmc',
      },
    ],
  },
];

describe('getExtensionWorkCreateOptions', () => {
  it('includes extension options when routes are enabled', () => {
    const options = getExtensionWorkCreateOptions({ pmc: { routes: true } }, mockExtensions, [
      'app:works:upload',
    ]);
    expect(options).toHaveLength(1);
    expect(options[0]?.id).toBe('pmc-deposit');
    expect(options[0]?.extensionId).toBe('pmc');
  });

  it('excludes extension options when routes are disabled', () => {
    const options = getExtensionWorkCreateOptions({ pmc: { routes: false } }, mockExtensions, [
      'app:works:upload',
    ]);
    expect(options).toHaveLength(0);
  });
});

describe('getAvailableWorkCreateOptions', () => {
  it('always includes the built-in Article option by default', () => {
    const options = getAvailableWorkCreateOptions({}, [], []);
    expect(options[0]?.id).toBe(BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID);
  });

  it('merges Article with enabled extension options', () => {
    const options = getAvailableWorkCreateOptions({ pmc: { routes: true } }, mockExtensions, []);
    expect(options.map((o) => o.id)).toEqual(['article', 'pmc-deposit']);
  });
});

describe('resolveWorkCreateOptionFromMetadata', () => {
  it('falls back to Article when no extension metadata key is present', () => {
    const resolved = resolveWorkCreateOptionFromMetadata({ checks: { enabled: [] } }, [
      BUILTIN_ARTICLE_WORK_CREATE_OPTION,
      pmcOption,
    ]);
    expect(resolved.id).toBe(BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID);
  });

  it('selects PMC when metadata.pmc is present', () => {
    const resolved = resolveWorkCreateOptionFromMetadata({ pmc: { title: 'Example' } }, [
      BUILTIN_ARTICLE_WORK_CREATE_OPTION,
      pmcOption,
    ]);
    expect(resolved.id).toBe('pmc-deposit');
  });

  it('prefers extension metadata over Article frontmatter key', () => {
    const resolved = resolveWorkCreateOptionFromMetadata(
      { pmc: {}, 'frontmatter.myst': { title: 'Article' } },
      [BUILTIN_ARTICLE_WORK_CREATE_OPTION, pmcOption],
    );
    expect(resolved.id).toBe('pmc-deposit');
  });
});

describe('getAllRegisteredWorkCreateOptions', () => {
  it('returns extension options regardless of routes config', () => {
    const options = getAllRegisteredWorkCreateOptions(mockExtensions);
    expect(options.map((o) => o.id)).toEqual(['pmc-deposit']);
    expect(options[0]?.extensionId).toBe('pmc');
  });
});

describe('resolveCreateNewVersionOption', () => {
  it('returns the available extension option for PMC metadata', () => {
    const result = resolveCreateNewVersionOption(
      { pmc: { title: 'Example' } },
      { pmc: { routes: true } },
      mockExtensions,
      ['app:works:upload'],
    );
    expect(result).toEqual({ ok: true, option: expect.objectContaining({ id: 'pmc-deposit' }) });
  });

  it('returns 403 when PMC metadata implies PMC but routes are disabled', () => {
    const result = resolveCreateNewVersionOption(
      { pmc: { title: 'Example' } },
      { pmc: { routes: false } },
      mockExtensions,
      ['app:works:upload'],
    );
    expect(result).toEqual({
      ok: false,
      error: 'The "PMC Deposit" create flow is not available.',
      status: 403,
    });
  });

  it('falls back to Article for non-extension metadata', () => {
    const result = resolveCreateNewVersionOption(
      { checks: { enabled: [] } },
      { pmc: { routes: true } },
      mockExtensions,
      [],
    );
    expect(result).toEqual({ ok: true, option: BUILTIN_ARTICLE_WORK_CREATE_OPTION });
  });
});

describe('invokeExtensionCreateWorkVersion', () => {
  const args = {
    ctx: {} as never,
    workId: 'work-1',
    sourceVersionMetadata: {},
    defaultTitle: 'Title',
  };

  it('returns null when extensionId is missing', async () => {
    await expect(invokeExtensionCreateWorkVersion([], undefined, args)).resolves.toBeNull();
  });

  it('returns null when no matching extension is registered', async () => {
    await expect(invokeExtensionCreateWorkVersion([], 'pmc', args)).resolves.toBeNull();
  });

  it('returns null when the extension has no createWorkVersion handler', async () => {
    const extensions: ServerExtension[] = [
      {
        id: 'pmc',
        name: 'PMC',
        description: 'PMC',
        registerNavigation: () => [],
      },
    ];
    await expect(invokeExtensionCreateWorkVersion(extensions, 'pmc', args)).resolves.toBeNull();
  });

  it('dispatches to the matching extension handler', async () => {
    const createWorkVersion = vi.fn(async () => ({
      success: true,
      workVersionId: 'work-version-1',
      redirectPath: '/deposit',
    }));
    const extensions: ServerExtension[] = [
      {
        id: 'pmc',
        name: 'PMC',
        description: 'PMC',
        registerNavigation: () => [],
        createWorkVersion,
      },
    ];

    await expect(invokeExtensionCreateWorkVersion(extensions, 'pmc', args)).resolves.toEqual({
      success: true,
      workVersionId: 'work-version-1',
      redirectPath: '/deposit',
    });
    expect(createWorkVersion).toHaveBeenCalledWith(args);
  });
});
