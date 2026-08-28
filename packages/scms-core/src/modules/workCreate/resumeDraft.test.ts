// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi } from 'vitest';
import type { ServerExtension, WorkCreateOption } from '../extensions/types.js';
import { BUILTIN_ARTICLE_WORK_CREATE_OPTION } from './builtinArticleOption.js';
import {
  interpolateResumePath,
  isArticleReusableDraft,
  isOnCreateFormPath,
  resolveDraftResumePath,
} from './resumeDraft.js';

const article = BUILTIN_ARTICLE_WORK_CREATE_OPTION;

const foundryOption: WorkCreateOption = {
  id: 'foundry',
  label: 'Work',
  metadataKey: 'foundry',
  startPath: '/app/works/foundry',
  extensionId: 'foundry',
  resumePath: '/app/works/:workId/foundry/:workVersionId',
  formPathIncludes: '/foundry/',
};

const pmcOption: WorkCreateOption = {
  id: 'pmc-deposit',
  label: 'PMC Deposit',
  metadataKey: 'pmc',
  startPath: '/app/works/pmc',
  extensionId: 'pmc',
  formPathIncludes: '/site/pmc/',
};

const options = [article, foundryOption, pmcOption];

describe('interpolateResumePath', () => {
  it('replaces work and version tokens', () => {
    expect(
      interpolateResumePath('/app/works/:workId/upload/:workVersionId', {
        workId: 'work-1',
        workVersionId: 'wv-1',
      }),
    ).toBe('/app/works/work-1/upload/wv-1');
  });

  it('appends from when provided', () => {
    expect(
      interpolateResumePath(
        '/app/works/:workId/foundry/:workVersionId',
        { workId: 'work-1', workVersionId: 'wv-1' },
        'details',
      ),
    ).toBe('/app/works/work-1/foundry/wv-1?from=details');
  });
});

describe('isOnCreateFormPath', () => {
  it('matches article upload and registered extension form fragments', () => {
    expect(isOnCreateFormPath('/app/works/work-1/upload/wv-1', 'work-1', options)).toBe(true);
    expect(isOnCreateFormPath('/app/works/work-1/foundry/wv-1/files', 'work-1', options)).toBe(
      true,
    );
    expect(isOnCreateFormPath('/app/works/work-1/site/pmc/deposit/sv-1', 'work-1', options)).toBe(
      true,
    );
    expect(isOnCreateFormPath('/app/works/work-1/details', 'work-1', options)).toBe(false);
  });
});

describe('isArticleReusableDraft', () => {
  it('accepts article drafts with checks', () => {
    expect(isArticleReusableDraft({ checks: { enabled: [] } }, options)).toBe(true);
  });

  it('rejects extension drafts even when they also have checks', () => {
    expect(isArticleReusableDraft({ foundry: {}, checks: { enabled: [] } }, options)).toBe(false);
    expect(isArticleReusableDraft({ pmc: {}, checks: { enabled: [] } }, options)).toBe(false);
  });

  it('rejects metadata without checks', () => {
    expect(isArticleReusableDraft({}, options)).toBe(false);
  });
});

describe('resolveDraftResumePath', () => {
  it('uses the article template by default', async () => {
    await expect(
      resolveDraftResumePath({
        workId: 'work-1',
        workVersionId: 'wv-1',
        metadata: { checks: { enabled: [] } },
        options,
        from: 'details',
      }),
    ).resolves.toBe('/app/works/work-1/upload/wv-1?from=details');
  });

  it('interpolates the matching extension resumePath', async () => {
    await expect(
      resolveDraftResumePath({
        workId: 'work-1',
        workVersionId: 'wv-1',
        metadata: { foundry: {}, checks: { enabled: [] } },
        options,
        from: 'details',
      }),
    ).resolves.toBe('/app/works/work-1/foundry/wv-1?from=details');
  });

  it('prefers the matching extension hook over article fallback', async () => {
    const resolveResumeDraftPath = vi.fn(async () => '/app/works/work-1/site/pmc/deposit/sv-1');
    const serverExtensions = [
      { id: 'pmc', resolveResumeDraftPath },
    ] as unknown as ServerExtension[];

    await expect(
      resolveDraftResumePath({
        workId: 'work-1',
        workVersionId: 'wv-1',
        metadata: { pmc: {} },
        options,
        serverExtensions,
        ctx: {} as never,
      }),
    ).resolves.toBe('/app/works/work-1/site/pmc/deposit/sv-1');
    expect(resolveResumeDraftPath).toHaveBeenCalledOnce();
  });

  it('falls back to article when the extension hook returns null', async () => {
    const serverExtensions = [
      { id: 'pmc', resolveResumeDraftPath: async () => null },
    ] as unknown as ServerExtension[];

    await expect(
      resolveDraftResumePath({
        workId: 'work-1',
        workVersionId: 'wv-1',
        metadata: { pmc: {} },
        options,
        serverExtensions,
        ctx: {} as never,
        from: 'details',
      }),
    ).resolves.toBe('/app/works/work-1/upload/wv-1?from=details');
  });
});
