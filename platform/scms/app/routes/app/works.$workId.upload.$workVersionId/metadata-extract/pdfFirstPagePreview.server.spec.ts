// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { OfficeContentNode } from 'officeparser';
import {
  isPdfFastPathTextSufficient,
  PDF_FAST_PATH_MIN_TEXT_LENGTH,
} from './pdfFirstPagePreview.server';
import type { PreviewAstData } from './previewAstUtils.server';

function pagePreview(text: string): PreviewAstData {
  return {
    type: 'pdf',
    metadata: { pages: 1 },
    content: [
      {
        type: 'page',
        children: [{ type: 'paragraph', children: [{ type: 'text', text }] }],
        metadata: { pageNumber: 1 },
      } as OfficeContentNode,
    ],
    wasTruncated: false,
  };
}

describe('isPdfFastPathTextSufficient', () => {
  it('returns true when text meets the minimum threshold', () => {
    expect(
      isPdfFastPathTextSufficient(pagePreview('A'.repeat(PDF_FAST_PATH_MIN_TEXT_LENGTH))),
    ).toBe(true);
  });

  it('returns false when text is below the minimum threshold', () => {
    expect(isPdfFastPathTextSufficient(pagePreview('short'))).toBe(false);
    expect(isPdfFastPathTextSufficient(pagePreview(''))).toBe(false);
  });
});
