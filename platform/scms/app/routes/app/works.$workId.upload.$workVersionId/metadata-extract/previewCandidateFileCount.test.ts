/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, it } from 'vitest';
import {
  computeMetadataExtractBusyFlags,
  stepPreviewCandidateCountChange,
  type PreviewCandidateCountRefs,
} from './previewCandidateFileCount';

const EMPTY_REFS: PreviewCandidateCountRefs = { prevCount: 0 };

describe('stepPreviewCandidateCountChange', () => {
  it('clears auto-extract state when the last preview-candidate file is removed', () => {
    const result = stepPreviewCandidateCountChange(
      { prevCount: 1 },
      { count: 0, hasSkippedPreview: false },
    );

    expect(result.refs).toEqual({ prevCount: 0 });
    expect(result.effects.clearAutoExtractPending).toBe(true);
    expect(result.effects.resetHasTriggered).toBe(true);
    expect(result.effects.retryPreview).toBeUndefined();
  });

  it('resumes preview flow when count increases after the user skipped preview', () => {
    const result = stepPreviewCandidateCountChange(
      { prevCount: 1 },
      { count: 2, hasSkippedPreview: true },
    );

    expect(result.effects.clearSkipFlags).toBe(true);
    expect(result.effects.retryPreview).toBe(true);
    expect(result.effects.clearAutoExtractPending).toBeUndefined();
  });

  it('does not retry preview when count increases but preview was not skipped', () => {
    const result = stepPreviewCandidateCountChange(
      { prevCount: 0 },
      { count: 1, hasSkippedPreview: false },
    );

    expect(result.effects.retryPreview).toBeUndefined();
    expect(result.effects.clearSkipFlags).toBeUndefined();
  });

  it('retries preview on first upload after empty set when preview was skipped', () => {
    const result = stepPreviewCandidateCountChange(EMPTY_REFS, {
      count: 1,
      hasSkippedPreview: true,
    });

    expect(result.effects.clearSkipFlags).toBe(true);
    expect(result.effects.retryPreview).toBe(true);
  });
});

describe('computeMetadataExtractBusyFlags', () => {
  const busyWhileLoading = {
    previewCandidateFileCount: 1,
    isPreviewsLoading: true,
    hasSkippedPreview: false,
    isExtractionInFlight: false,
    isAutoExtractPending: false,
    hasSkippedExtraction: false,
  };

  it('keeps preview overlay active while unpacking even when previewList would be empty', () => {
    const flags = computeMetadataExtractBusyFlags(busyWhileLoading);

    expect(flags.effectiveIsPreviewsLoading).toBe(true);
  });

  it('clears preview and extraction overlays when the last file is removed mid-flight', () => {
    const flags = computeMetadataExtractBusyFlags({
      previewCandidateFileCount: 0,
      isPreviewsLoading: true,
      hasSkippedPreview: false,
      isExtractionInFlight: true,
      isAutoExtractPending: true,
      hasSkippedExtraction: false,
    });

    expect(flags.effectiveIsPreviewsLoading).toBe(false);
    expect(flags.isExtractingMetadata).toBe(false);
  });

  it('does not show preview overlay when preview was skipped but files remain', () => {
    const flags = computeMetadataExtractBusyFlags({
      ...busyWhileLoading,
      hasSkippedPreview: true,
    });

    expect(flags.effectiveIsPreviewsLoading).toBe(false);
  });

  it('does not show extraction overlay when extraction was skipped', () => {
    const flags = computeMetadataExtractBusyFlags({
      previewCandidateFileCount: 1,
      isPreviewsLoading: false,
      hasSkippedPreview: false,
      isExtractionInFlight: true,
      isAutoExtractPending: false,
      hasSkippedExtraction: true,
    });

    expect(flags.isExtractingMetadata).toBe(false);
  });
});
