// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { EligibleKindDTO } from '../../backend/doi/types.js';
import {
  draftFromKinds,
  draftToField,
  isDraftDirty,
  setContentType,
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

  it('changing the select changes the value', () => {
    const draft = setContentType(
      setEligible(draftFromKinds(kinds), 'kind-article', true),
      'kind-article',
      'PREPRINT',
    );
    expect(draft['kind-article']).toBe('PREPRINT');
  });

  it('treats a kind missing from the draft as not eligible', () => {
    const added = [...kinds, { id: 'kind-new', title: 'New', doiContentType: null, locked: false }];
    expect(isDraftDirty(added, draftFromKinds(kinds))).toBe(false);
  });

  it('writes every shown kind into the form field', () => {
    const draft = setEligible(draftFromKinds(kinds), 'kind-article', true);
    expect(JSON.parse(draftToField(kinds, draft))).toEqual([
      { kindId: 'kind-article', doiContentType: 'PREPRINT' },
      { kindId: 'kind-blog', doiContentType: 'PREPRINT' },
    ]);
  });
});
