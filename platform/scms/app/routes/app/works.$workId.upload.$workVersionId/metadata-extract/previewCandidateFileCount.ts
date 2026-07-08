/**
 * Preview-candidate file count lifecycle for the metadata-extract upload flow.
 *
 * `previewCandidateFileCount` is the number of `isPreviewCandidate` files in upload
 * metadata (see route `previewFilePaths.length`). It differs from `previewList.length`,
 * which only includes files with cached previews already loaded. Use the count for
 * busy-state gating and upload lifecycle; use `previewList` for rendering previews
 * and triggering auto-extract when previews arrive.
 */

export interface PreviewCandidateCountRefs {
  prevCount: number;
}

export interface PreviewCandidateCountInput {
  count: number;
  hasSkippedPreview: boolean;
}

export interface PreviewCandidateCountEffects {
  clearAutoExtractPending?: boolean;
  resetHasTriggered?: boolean;
  clearSkipFlags?: boolean;
  retryPreview?: boolean;
}

export interface PreviewCandidateCountStepResult {
  refs: PreviewCandidateCountRefs;
  effects: PreviewCandidateCountEffects;
}

/**
 * Advance state when the preview-candidate file count changes (metadata revalidation).
 *
 * - Count → 0: stop in-flight busy overlays and allow a future upload to auto-extract.
 * - Count increases while preview was skipped: resume the normal preview + extract flow.
 */
export function stepPreviewCandidateCountChange(
  refs: PreviewCandidateCountRefs,
  input: PreviewCandidateCountInput,
): PreviewCandidateCountStepResult {
  const prevCount = refs.prevCount;
  const { count, hasSkippedPreview } = input;
  const effects: PreviewCandidateCountEffects = {};
  const nextRefs: PreviewCandidateCountRefs = { prevCount: count };

  if (count === 0) {
    effects.clearAutoExtractPending = true;
    effects.resetHasTriggered = true;
    return { refs: nextRefs, effects };
  }

  if (count > prevCount && hasSkippedPreview) {
    effects.clearSkipFlags = true;
    effects.retryPreview = true;
  }

  return { refs: nextRefs, effects };
}

export interface MetadataExtractBusyInput {
  previewCandidateFileCount: number;
  isPreviewsLoading: boolean;
  hasSkippedPreview: boolean;
  isExtractionInFlight: boolean;
  isAutoExtractPending: boolean;
  hasSkippedExtraction: boolean;
}

export interface MetadataExtractBusyFlags {
  hasPreviewCandidateFiles: boolean;
  effectiveIsPreviewsLoading: boolean;
  isExtractingMetadata: boolean;
}

/** Derived busy overlays gated on preview-candidate files still in the upload area. */
export function computeMetadataExtractBusyFlags(
  input: MetadataExtractBusyInput,
): MetadataExtractBusyFlags {
  const hasPreviewCandidateFiles = input.previewCandidateFileCount > 0;
  return {
    hasPreviewCandidateFiles,
    effectiveIsPreviewsLoading:
      input.isPreviewsLoading && !input.hasSkippedPreview && hasPreviewCandidateFiles,
    isExtractingMetadata:
      (input.isExtractionInFlight || input.isAutoExtractPending) &&
      !input.hasSkippedExtraction &&
      hasPreviewCandidateFiles,
  };
}
