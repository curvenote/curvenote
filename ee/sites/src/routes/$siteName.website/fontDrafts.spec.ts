// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  activeDraft,
  editDraft,
  reconcileDrafts,
  seedDrafts,
  switchDraftTab,
} from './fontDrafts.js';

const google = { family: 'Lora', source: 'google' as const, weights: [400, 700] };
const custom = {
  family: 'Matter',
  source: 'custom' as const,
  faces: [{ src: 'https://c/m.woff2' }],
};

describe('font slot drafts', () => {
  it('seeds on the tab the stored value belongs to', () => {
    expect(seedDrafts(undefined)).toEqual({ tab: 'choose', drafts: {} });
    expect(seedDrafts(google)).toEqual({ tab: 'choose', drafts: { google } });
    expect(seedDrafts(custom)).toEqual({ tab: 'upload', drafts: { custom } });
  });

  it('switching to Upload keeps the chosen font, and switching back restores it', () => {
    let state = seedDrafts(google);
    state = switchDraftTab(state, 'upload');
    expect(activeDraft(state)).toEqual({ family: '', source: 'custom', faces: [] });
    // the parent echoes that value back — it must be recognised as ours
    state = reconcileDrafts(state, activeDraft(state));
    expect(state.drafts.google).toEqual(google);
    state = switchDraftTab(state, 'choose');
    expect(activeDraft(state)).toEqual(google);
  });

  it('an upload in progress survives a trip to Choose', () => {
    let state = seedDrafts(undefined);
    state = switchDraftTab(state, 'upload');
    state = editDraft(state, 'upload', custom);
    state = reconcileDrafts(state, activeDraft(state));
    state = switchDraftTab(state, 'choose');
    expect(activeDraft(state)).toBeUndefined();
    state = reconcileDrafts(state, undefined);
    expect(state.drafts.custom).toEqual(custom);
    state = switchDraftTab(state, 'upload');
    expect(activeDraft(state)).toEqual(custom);
  });

  it('a value from outside (Reset) replaces both drafts', () => {
    let state = seedDrafts(google);
    state = switchDraftTab(state, 'upload');
    state = editDraft(state, 'upload', custom);
    state = reconcileDrafts(state, { family: 'Inter', source: 'google' });
    expect(state).toEqual({
      tab: 'choose',
      drafts: { google: { family: 'Inter', source: 'google' } },
    });
  });
});
