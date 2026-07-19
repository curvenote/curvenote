/* eslint-disable import/no-extraneous-dependencies */
import { describe, it, expect } from 'vitest';
import {
  stepAutoExtractOnPreviewChange,
  type AutoExtractInput,
  type AutoExtractRefs,
} from './autoExtractOnPreviewChange';

const EMPTY_REFS: AutoExtractRefs = { prevFileCount: 0, hasTriggered: false };

function step(refs: AutoExtractRefs, overrides: Partial<AutoExtractInput> = {}) {
  return stepAutoExtractOnPreviewChange(refs, {
    previewCount: 1,
    metadataIsEmpty: true,
    effectiveIsPreviewsLoading: false,
    hasSkippedPreview: false,
    hasSkippedExtraction: false,
    extractFetcherState: 'idle',
    ...overrides,
  });
}

describe('stepAutoExtractOnPreviewChange', () => {
  it('submits once when previews go 0→N while the fetcher is idle', () => {
    const result = step(EMPTY_REFS, { previewCount: 2 });

    expect(result.refs).toEqual({ prevFileCount: 2, hasTriggered: true });
    expect(result.effects.submitExtractMetadata).toBe(true);
    expect(result.effects.autoExtractPending).toBe(true);
  });

  it('defers submit when fetcher is busy on 0→N, then submits once when idle', () => {
    const busy = step(EMPTY_REFS, {
      previewCount: 1,
      extractFetcherState: 'loading',
    });

    expect(busy.refs).toEqual({ prevFileCount: 0, hasTriggered: false });
    expect(busy.effects.submitExtractMetadata).toBeUndefined();

    const idle = step(busy.refs, {
      previewCount: 1,
      extractFetcherState: 'idle',
    });

    expect(idle.refs).toEqual({ prevFileCount: 1, hasTriggered: true });
    expect(idle.effects.submitExtractMetadata).toBe(true);
  });

  it('does not submit when metadata is already populated on 0→N', () => {
    const result = step(EMPTY_REFS, { metadataIsEmpty: false });

    expect(result.refs).toEqual({ prevFileCount: 1, hasTriggered: false });
    expect(result.effects.submitExtractMetadata).toBeUndefined();
    expect(result.effects.autoExtractPending).toBe(false);
  });

  it('does not submit when preview or extraction was skipped on 0→N', () => {
    const skippedPreview = step(EMPTY_REFS, { hasSkippedPreview: true });
    expect(skippedPreview.effects.submitExtractMetadata).toBeUndefined();
    expect(skippedPreview.refs.prevFileCount).toBe(1);

    const skippedExtraction = step(EMPTY_REFS, { hasSkippedExtraction: true });
    expect(skippedExtraction.effects.submitExtractMetadata).toBeUndefined();
    expect(skippedExtraction.refs.prevFileCount).toBe(1);
  });

  it('resets hasTriggered when previews drop to zero', () => {
    const afterUpload = step(EMPTY_REFS);
    const cleared = step(afterUpload.refs, { previewCount: 0 });

    expect(cleared.refs).toEqual({ prevFileCount: 0, hasTriggered: false });
  });

  it('bridges auto-extract pending while unpacking with an empty preview list', () => {
    const result = step(EMPTY_REFS, {
      previewCount: 0,
      effectiveIsPreviewsLoading: true,
    });

    expect(result.effects.autoExtractPending).toBe(true);
    expect(result.effects.submitExtractMetadata).toBeUndefined();
  });
});
