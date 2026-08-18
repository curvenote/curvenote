export type ExtractFetcherState = 'idle' | 'submitting' | 'loading';

export interface AutoExtractRefs {
  prevFileCount: number;
  hasTriggered: boolean;
}

export interface AutoExtractInput {
  previewCount: number;
  metadataIsEmpty: boolean;
  effectiveIsPreviewsLoading: boolean;
  hasSkippedPreview: boolean;
  hasSkippedExtraction: boolean;
  extractFetcherState: ExtractFetcherState;
}

export interface AutoExtractEffects {
  /** When defined, update `isAutoExtractPending` to this value. */
  autoExtractPending?: boolean;
  /** Fire the extract-metadata action once. */
  submitExtractMetadata?: boolean;
}

export interface AutoExtractStepResult {
  refs: AutoExtractRefs;
  effects: AutoExtractEffects;
}

/**
 * Advance the auto-extract state machine when the preview list changes.
 *
 * `hasTriggered` and `prevFileCount` must stay in lockstep: both advance together
 * on submit or when auto-extract is skipped/deemed unnecessary; both reset together
 * when the preview list goes empty. Advancing only one will stall retries or skip
 * extraction silently.
 */
export function stepAutoExtractOnPreviewChange(
  refs: AutoExtractRefs,
  input: AutoExtractInput,
): AutoExtractStepResult {
  const {
    previewCount,
    metadataIsEmpty,
    effectiveIsPreviewsLoading,
    hasSkippedPreview,
    hasSkippedExtraction,
    extractFetcherState,
  } = input;
  const prevCount = refs.prevFileCount;
  const effects: AutoExtractEffects = {};
  let nextRefs = { ...refs };

  if (previewCount === 0) {
    nextRefs = { prevFileCount: 0, hasTriggered: false };
    if (prevCount === 0 && effectiveIsPreviewsLoading && metadataIsEmpty) {
      effects.autoExtractPending = true;
    } else if (!effectiveIsPreviewsLoading) {
      effects.autoExtractPending = false;
    }
    return { refs: nextRefs, effects };
  }

  if (prevCount === 0) {
    if (metadataIsEmpty && !refs.hasTriggered && !hasSkippedPreview && !hasSkippedExtraction) {
      if (extractFetcherState === 'idle') {
        nextRefs = { prevFileCount: previewCount, hasTriggered: true };
        effects.autoExtractPending = true;
        effects.submitExtractMetadata = true;
      }
      // Fetcher busy: keep prevFileCount at 0 so we retry when it becomes idle.
    } else if (!metadataIsEmpty || hasSkippedPreview || hasSkippedExtraction) {
      effects.autoExtractPending = false;
      nextRefs = { ...refs, prevFileCount: previewCount };
    }
    return { refs: nextRefs, effects };
  }

  return {
    refs: { ...refs, prevFileCount: previewCount },
    effects,
  };
}
