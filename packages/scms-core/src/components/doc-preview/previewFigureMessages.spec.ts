// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { figuresBusyMessageForPreviews, isPdfManuscriptPreview } from './previewFigureMessages.js';

describe('figuresBusyMessageForPreviews', () => {
  it('returns the default busy message', () => {
    expect(
      figuresBusyMessageForPreviews(
        [{ path: 'manuscript/paper.pdf', data: { type: 'application/pdf', name: 'paper.pdf' } }],
        true,
      ),
    ).toBe('Generating thumbnail options…');
  });
});

describe('isPdfManuscriptPreview', () => {
  it('detects PDF by extension or MIME type', () => {
    expect(isPdfManuscriptPreview({ path: 'uploads/paper.pdf' })).toBe(true);
    expect(isPdfManuscriptPreview({ type: 'application/pdf', name: 'paper' })).toBe(true);
    expect(isPdfManuscriptPreview({ path: 'uploads/paper.docx' })).toBe(false);
  });
});
