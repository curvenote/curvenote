/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, it } from 'vitest';
import type { WorkCreateOption } from '@curvenote/scms-core';
import { BUILTIN_ARTICLE_WORK_CREATE_OPTION } from '@curvenote/scms-core';
import { isValidDraftForReuse } from './getDrafts.server';

const options: WorkCreateOption[] = [
  BUILTIN_ARTICLE_WORK_CREATE_OPTION,
  {
    id: 'foundry',
    label: 'Work',
    metadataKey: 'foundry',
    startPath: '/app/works/foundry',
    extensionId: 'foundry',
  },
  {
    id: 'pmc-deposit',
    label: 'PMC Deposit',
    metadataKey: 'pmc',
    startPath: '/app/works/pmc',
    extensionId: 'pmc',
  },
];

describe('isValidDraftForReuse', () => {
  it('accepts single-version article drafts with checks', () => {
    expect(
      isValidDraftForReuse(
        {
          versions: [{ metadata: { checks: { enabled: [] } } }],
        },
        options,
      ),
    ).toBe(true);
  });

  it('rejects extension drafts even when they also have checks', () => {
    expect(
      isValidDraftForReuse(
        {
          versions: [{ metadata: { foundry: {}, checks: { enabled: [] } } }],
        },
        options,
      ),
    ).toBe(false);
    expect(
      isValidDraftForReuse(
        {
          versions: [{ metadata: { pmc: {}, checks: { enabled: [] } } }],
        },
        options,
      ),
    ).toBe(false);
  });

  it('rejects works without checks or with multiple versions', () => {
    expect(isValidDraftForReuse({ versions: [{ metadata: {} }] }, options)).toBe(false);
    expect(
      isValidDraftForReuse(
        {
          versions: [
            { metadata: { checks: { enabled: [] } } },
            { metadata: { checks: { enabled: [] } } },
          ],
        },
        options,
      ),
    ).toBe(false);
  });
});
