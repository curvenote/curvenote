import { describe, expect, it } from 'vitest';
import {
  WORK_VERSION_DOCX_MIME,
  hasDocxInMetadata,
  hasPdfInMetadata,
} from './workVersionMetadata.js';

describe('workVersionMetadata', () => {
  it('hasPdfInMetadata detects application/pdf and .pdf names', () => {
    expect(hasPdfInMetadata(undefined)).toBe(false);
    expect(hasPdfInMetadata({ files: {} })).toBe(false);
    expect(
      hasPdfInMetadata({
        files: { a: { type: 'application/pdf' } },
      }),
    ).toBe(true);
    expect(
      hasPdfInMetadata({
        files: { a: { name: 'Paper.PDF' } },
      }),
    ).toBe(true);
    expect(
      hasPdfInMetadata({
        files: { a: { path: 'exports/paper.pdf' } },
      }),
    ).toBe(true);
  });

  it('hasDocxInMetadata detects docx MIME and .docx paths', () => {
    expect(hasDocxInMetadata(undefined)).toBe(false);
    expect(
      hasDocxInMetadata({
        files: { a: { type: WORK_VERSION_DOCX_MIME } },
      }),
    ).toBe(true);
    expect(
      hasDocxInMetadata({
        files: { a: { name: 'Manuscript.DOCX' } },
      }),
    ).toBe(true);
    expect(
      hasDocxInMetadata({
        files: { a: { path: 'word/file.docx' } },
      }),
    ).toBe(true);
  });
});
