import { describe, expect, it } from 'vitest';
import type { FileMetadataSectionItem } from '@curvenote/scms-core';
import {
  classifyPreviewOutcome,
  previewFailureReason,
  summarizeExtractedMetadata,
  summarizePreviewCandidateFiles,
  summarizePreviewResults,
} from './uploadFlowAnalytics.server.js';
import type { DocumentPreviewItem } from './fetchPreviews.server.js';

const docxFile = (size: number): FileMetadataSectionItem => ({
  name: 'paper.docx',
  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  path: 'uploads/wv/paper.docx',
  size,
  md5: 'abc',
  slot: 'manuscript',
  uploadDate: '2026-01-01',
});

function previewItem(overrides: Partial<DocumentPreviewItem> = {}): DocumentPreviewItem {
  return {
    path: 'uploads/wv/paper.docx',
    data: docxFile(1000),
    ast: { type: 'docx', metadata: {}, content: [], wasTruncated: false },
    figures: [],
    ...overrides,
  };
}

describe('uploadFlowAnalytics', () => {
  it('summarizes preview candidate files', () => {
    const summary = summarizePreviewCandidateFiles(
      { a: docxFile(1000), b: docxFile(2000) },
      () => true,
    );
    expect(summary.previewCandidateCount).toBe(2);
    expect(summary.totalFileSizeBytes).toBe(3000);
    expect(summary.fileTypes).toHaveLength(1);
  });

  it('classifies preview outcomes', () => {
    expect(classifyPreviewOutcome(0, [])).toBe('skipped');
    expect(classifyPreviewOutcome(1, [])).toBe('failed');
    expect(classifyPreviewOutcome(1, [previewItem({ previewUnavailable: true })])).toBe('failed');
    expect(classifyPreviewOutcome(1, [previewItem()])).toBe('completed');
  });

  it('derives preview failure reasons', () => {
    expect(previewFailureReason(1, [])).toBe('no_previews_generated');
    expect(previewFailureReason(2, [previewItem({ previewUnavailable: true })])).toBe(
      'all_unavailable',
    );
  });

  it('summarizes preview results counts', () => {
    const summary = summarizePreviewResults(
      [previewItem({ figures: [{ key: 'k1' }, { key: 'k2' }] }), previewItem()],
      3,
    );
    expect(summary.previewsGeneratedCount).toBe(2);
    expect(summary.previewsMissingCount).toBe(1);
    expect(summary.totalFigureCount).toBe(2);
  });

  it('summarizes extracted metadata without PII', () => {
    const summary = summarizeExtractedMetadata({
      title: 'Secret title',
      doi: '10.1234/example',
      authors: [{ name: 'Ada Lovelace' }, { name: 'Alan Turing' }],
      affiliations: [{ name: 'Example Lab' }],
    });
    expect(summary).toEqual({
      authorCount: 2,
      affiliationCount: 1,
      hasTitle: true,
      hasDoi: true,
    });
  });
});
