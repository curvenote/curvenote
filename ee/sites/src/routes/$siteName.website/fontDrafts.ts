import type { FontSlot } from '../../themeConfig/types.js';
import { fontSlotSource } from '../../themeConfig/fonts.js';

/*
 * A slot editor keeps a draft per tab so flipping between "Choose a font" and "Upload a
 * font" loses nothing until Save or Reset. These are the state transitions, kept pure so they
 * can be tested without a DOM.
 */

export type DraftTab = 'choose' | 'upload';
export type Drafts = { google?: FontSlot; custom?: FontSlot };
export type DraftState = { tab: DraftTab; drafts: Drafts };

const EMPTY_CUSTOM: FontSlot = { family: '', source: 'custom', faces: [] };

export const signatureOf = (slot: FontSlot | undefined) => JSON.stringify(slot ?? null);

/** Seed from a stored value: whichever tab the value belongs to is active. */
export function seedDrafts(slot: FontSlot | undefined): DraftState {
  const source = fontSlotSource(slot);
  return {
    tab: source === 'custom' ? 'upload' : 'choose',
    drafts: {
      google: source === 'google' ? slot : undefined,
      custom: source === 'custom' ? slot : undefined,
    },
  };
}

/** The value the active tab stands for — what the editor reports upward. */
export function activeDraft(state: DraftState): FontSlot | undefined {
  return state.tab === 'upload' ? state.drafts.custom : state.drafts.google;
}

/**
 * A new value arrived from the parent. If it is one of our own drafts coming back round,
 * keep everything; otherwise it was replaced from outside (Reset, new loader data) and both
 * drafts start again from it.
 */
export function reconcileDrafts(state: DraftState, incoming: FontSlot | undefined): DraftState {
  const signature = signatureOf(incoming);
  const ours =
    signature === signatureOf(state.drafts.google) ||
    signature === signatureOf(state.drafts.custom) ||
    (incoming === undefined && state.drafts.google === undefined);
  return ours ? state : seedDrafts(incoming);
}

/** Switch tabs; the other tab's draft is kept. Upload materialises an empty draft on first visit. */
export function switchDraftTab(state: DraftState, tab: DraftTab): DraftState {
  if (tab === state.tab) return state;
  if (tab === 'upload') {
    return { tab, drafts: { ...state.drafts, custom: state.drafts.custom ?? EMPTY_CUSTOM } };
  }
  return { tab, drafts: state.drafts };
}

/** Edit the draft behind a tab. */
export function editDraft(
  state: DraftState,
  tab: DraftTab,
  slot: FontSlot | undefined,
): DraftState {
  return tab === 'upload'
    ? { ...state, drafts: { ...state.drafts, custom: slot } }
    : { ...state, drafts: { ...state.drafts, google: slot } };
}
