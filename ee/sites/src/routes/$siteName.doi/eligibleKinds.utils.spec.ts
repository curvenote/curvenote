// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { EligibleKindDTO } from '../../backend/doi/types.js';
import {
  draftFromKinds,
  draftToField,
  isDraftDirty,
  savedMappingKey,
  setEligible,
} from './eligibleKinds.utils.js';

const kinds: EligibleKindDTO[] = [
  { id: 'kind-article', title: 'Article', doiContentType: null, locked: false },
  { id: 'kind-blog', title: 'Blog', doiContentType: 'PREPRINT', locked: true },
];

describe('eligible kinds draft', () => {
  it('starts from the saved values and is not dirty', () => {
    const draft = draftFromKinds(kinds);
    expect(draft).toEqual({ 'kind-article': null, 'kind-blog': 'PREPRINT' });
    expect(isDraftDirty(kinds, draft)).toBe(false);
  });

  it('checking a kind picks Preprint, unchecking clears it', () => {
    const checked = setEligible(draftFromKinds(kinds), 'kind-article', true);
    expect(checked['kind-article']).toBe('PREPRINT');
    expect(isDraftDirty(kinds, checked)).toBe(true);
    expect(isDraftDirty(kinds, setEligible(checked, 'kind-article', false))).toBe(false);
  });

  it('treats a kind missing from the draft as not eligible', () => {
    const added = [...kinds, { id: 'kind-new', title: 'New', doiContentType: null, locked: false }];
    expect(isDraftDirty(added, draftFromKinds(kinds))).toBe(false);
  });

  it('writes only the kinds the admin changed into the form field', () => {
    const draft = setEligible(draftFromKinds(kinds), 'kind-article', true);
    expect(JSON.parse(draftToField(kinds, draft))).toEqual([
      { kindId: 'kind-article', doiContentType: 'PREPRINT' },
    ]);
  });

  it('keys the saved mapping by each kind and its content type', () => {
    const saved = savedMappingKey(kinds);
    expect(savedMappingKey(kinds)).toBe(saved);
    expect(savedMappingKey([{ ...kinds[0], doiContentType: 'PREPRINT' }, kinds[1]])).not.toBe(
      saved,
    );
    expect(savedMappingKey([kinds[0]])).not.toBe(saved);
  });
});
