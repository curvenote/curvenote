// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { ClientExtension, WorkCreateOption } from '../extensions/types.js';
import {
  BUILTIN_ARTICLE_WORK_CREATE_OPTION,
  BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID,
} from './builtinArticleOption.js';
import {
  getAvailableWorkCreateOptions,
  getExtensionWorkCreateOptions,
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
