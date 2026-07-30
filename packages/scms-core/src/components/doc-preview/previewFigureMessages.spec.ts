// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { figuresBusyMessageForPreviews, isPdfManuscriptPreview } from './previewFigureMessages.js';

describe('figuresBusyMessageForPreviews', () => {
  it('uses the PDF-specific message while figures are loading', () => {
    expect(
      figuresBusyMessageForPreviews(
        [{ path: 'manuscript/paper.pdf', data: { type: 'application/pdf', name: 'paper.pdf' } }],
        true,
      ),
    ).toBe(
      "PDF thumbnails can take longer. Missing images in this preview doesn't mean they're missing from your document.",
    );
  });

  it('keeps the default message for non-PDF previews', () => {
    expect(
      figuresBusyMessageForPreviews(
        [
          {
            path: 'manuscript/paper.docx',
            data: {
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              name: 'paper.docx',
            },
          },
        ],
        true,
      ),
    ).toBe('Generating thumbnail options…');
  });

  it('keeps the default message when figures are not loading', () => {
    expect(
      figuresBusyMessageForPreviews(
        [{ path: 'manuscript/paper.pdf', data: { type: 'application/pdf', name: 'paper.pdf' } }],
        false,
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
