// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  WORK_VERSION_DOCX_MIME,
  getFilesForSlot,
  hasDocxInMetadata,
  hasInvalidEnabledUploadChecks,
  hasPdfInMetadata,
  isDocxOrPdfFile,
  resolveUploadCheckCardState,
  hasMaintenanceEnabledUploadChecks,
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

  it('getFilesForSlot returns only entries for the slot', () => {
    const metadata = {
      files: {
        a: { slot: 'manuscript', name: 'a.pdf', size: 1 },
        b: { slot: 'figures', name: 'b.png', size: 2 },
        c: { slot: 'manuscript', name: 'c.docx', size: 3 },
      },
    };
    expect(getFilesForSlot(metadata, 'manuscript')).toHaveLength(2);
    expect(getFilesForSlot(metadata, 'figures')).toHaveLength(1);
    expect(getFilesForSlot(undefined, 'manuscript')).toEqual([]);
  });

  it('isDocxOrPdfFile accepts pdf and docx by type or extension', () => {
    expect(isDocxOrPdfFile({ type: 'application/pdf' })).toBe(true);
    expect(isDocxOrPdfFile({ name: 'x.docx' })).toBe(true);
    expect(isDocxOrPdfFile({ name: 'x.png' })).toBe(false);
  });

  it('hasInvalidEnabledUploadChecks detects ineligible enabled services', () => {
    const services = [
      {
        id: 'proofig',
        isUploadEligible: (m: unknown) => getFilesForSlot(m, 'manuscript').length === 1,
      },
    ];
    expect(hasInvalidEnabledUploadChecks({ files: {} }, ['proofig'], services)).toBe(true);
    expect(
      hasInvalidEnabledUploadChecks(
        {
          files: {
            a: { slot: 'manuscript', type: 'application/pdf', size: 1 },
          },
        },
        ['proofig'],
        services,
      ),
    ).toBe(false);
  });

  it('resolveUploadCheckCardState maps eligible + enabled to card modes', () => {
    expect(resolveUploadCheckCardState({ eligible: true, enabled: false })).toEqual({
      disabled: false,
      invalid: false,
    });
    expect(resolveUploadCheckCardState({ eligible: true, enabled: true })).toEqual({
      disabled: false,
      invalid: false,
    });
    expect(resolveUploadCheckCardState({ eligible: false, enabled: false })).toEqual({
      disabled: false,
      invalid: false,
    });
    expect(resolveUploadCheckCardState({ eligible: false, enabled: true })).toEqual({
      disabled: false,
      invalid: true,
    });
    expect(
      resolveUploadCheckCardState({ eligible: true, enabled: false, underMaintenance: true }),
    ).toEqual({
      disabled: true,
      invalid: false,
    });
  });

  it('hasMaintenanceEnabledUploadChecks detects enabled services under maintenance', () => {
    expect(
      hasMaintenanceEnabledUploadChecks(['checks-text-integrity'], {
        'checks-text-integrity': { underMaintenance: true, message: 'Down' },
      }),
    ).toBe(true);
    expect(
      hasMaintenanceEnabledUploadChecks(['checks-text-integrity'], {
        proofig: { underMaintenance: true, message: 'Down' },
      }),
    ).toBe(false);
  });
});
