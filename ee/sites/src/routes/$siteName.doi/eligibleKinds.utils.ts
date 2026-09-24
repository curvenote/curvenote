import { DOI_CONTENT_TYPE } from '@curvenote/scms-core';
import type { EligibleKindDTO } from '../../backend/doi/types.js';

/** Kind id -> the DOI content type the form will save; null is not eligible. */
export type KindMappingDraft = Record<string, string | null>;

export function draftFromKinds(kinds: EligibleKindDTO[]): KindMappingDraft {
  return Object.fromEntries(kinds.map((kind) => [kind.id, kind.doiContentType]));
}

/** Checking a kind picks Preprint, the only DOI content type; unchecking clears it. */
export function setEligible(
  draft: KindMappingDraft,
  kindId: string,
  eligible: boolean,
): KindMappingDraft {
  return { ...draft, [kindId]: eligible ? DOI_CONTENT_TYPE.PREPRINT : null };
}

/** A kind the draft does not know yet, e.g. one created in another tab, counts as not eligible. */
export function isDraftDirty(kinds: EligibleKindDTO[], draft: KindMappingDraft): boolean {
  return kinds.some((kind) => (draft[kind.id] ?? null) !== kind.doiContentType);
}

/** The `kinds` field the action parses: every row shown, so unchanged kinds stay as saved. */
export function draftToField(kinds: EligibleKindDTO[], draft: KindMappingDraft): string {
  return JSON.stringify(
    kinds.map((kind) => ({ kindId: kind.id, doiContentType: draft[kind.id] ?? null })),
  );
}
