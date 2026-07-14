// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  encodeRgbaAsBmp,
  isPdfFigureLargeEnough,
  isPdfFigureWithinMaterializationLimits,
  PDF_FIGURE_MAX_EDGE_PX,
  PDF_FIGURE_MIN_EDGE_PX,
} from './pdfFigureExtraction.server';
import { figuresBusyMessageForPreviews, isPdfManuscriptPreview } from './previewFigureMessages';

describe('isPdfFigureLargeEnough', () => {
  it('accepts images at or above the minimum edge', () => {
    expect(isPdfFigureLargeEnough(PDF_FIGURE_MIN_EDGE_PX, PDF_FIGURE_MIN_EDGE_PX)).toBe(true);
    expect(isPdfFigureLargeEnough(200, 100)).toBe(true);
  });

  it('rejects tiny decorative images', () => {
    expect(isPdfFigureLargeEnough(PDF_FIGURE_MIN_EDGE_PX - 1, 64)).toBe(false);
    expect(isPdfFigureLargeEnough(64, PDF_FIGURE_MIN_EDGE_PX - 1)).toBe(false);
  });
});

describe('isPdfFigureWithinMaterializationLimits', () => {
  it('accepts typical figure dimensions', () => {
    expect(isPdfFigureWithinMaterializationLimits(400, 300)).toBe(true);
    expect(isPdfFigureWithinMaterializationLimits(PDF_FIGURE_MAX_EDGE_PX, 100)).toBe(true);
  });

  it('rejects oversized rasters before materialization', () => {
    expect(isPdfFigureWithinMaterializationLimits(PDF_FIGURE_MAX_EDGE_PX + 1, 100)).toBe(false);
    expect(isPdfFigureWithinMaterializationLimits(100, PDF_FIGURE_MAX_EDGE_PX + 1)).toBe(false);
    expect(
      isPdfFigureWithinMaterializationLimits(PDF_FIGURE_MAX_EDGE_PX, PDF_FIGURE_MAX_EDGE_PX + 1),
    ).toBe(false);
  });
});

describe('encodeRgbaAsBmp', () => {
  it('produces a BMP buffer with the expected signature', () => {
    const rgba = Buffer.alloc(4 * 4, 0);
    rgba[0] = 255;
    rgba[1] = 0;
    rgba[2] = 0;
    rgba[3] = 255;
    const bmp = encodeRgbaAsBmp(1, 1, rgba);
    expect(bmp.subarray(0, 2).toString('ascii')).toBe('BM');
    expect(bmp.length).toBeGreaterThan(54);
  });
});

describe('figuresBusyMessageForPreviews', () => {
  it('uses the PDF-specific message while figures are loading', () => {
    expect(
      figuresBusyMessageForPreviews(
        [{ path: 'manuscript/paper.pdf', data: { type: 'application/pdf', name: 'paper.pdf' } }],
        true,
      ),
    ).toBe(
      'Extracting thumbnails from PDF can take longer. This is a preview and if not all images are shown this does not mean they are missing from your document.',
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
});

describe('isPdfManuscriptPreview', () => {
  it('detects PDF by extension or MIME type', () => {
    expect(isPdfManuscriptPreview({ path: 'uploads/paper.pdf' })).toBe(true);
    expect(isPdfManuscriptPreview({ type: 'application/pdf', name: 'paper' })).toBe(true);
    expect(isPdfManuscriptPreview({ path: 'uploads/paper.docx' })).toBe(false);
  });
});
