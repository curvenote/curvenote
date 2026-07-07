// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { UploadCheckEligibilityContext } from '../modules/extensions/types.js';
import {
  WORK_VERSION_DOCX_MIME,
  UPLOAD_ANALYSIS_METADATA_KEY,
  computeManuscriptSourceSignature,
  getFilesForSlot,
  getUploadCheckEligibilityContext,
  hasDocxInMetadata,
  hasInvalidEnabledUploadChecks,
  hasPdfInMetadata,
  isDocxOrPdfFile,
  resolveUploadCheckCardState,
  hasMaintenanceEnabledUploadChecks,
  uploadFactPresenceFromValue,
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

  it('computes manuscript source signatures from md5 or path', () => {
    expect(
      computeManuscriptSourceSignature({
        files: {
          b: { slot: 'manuscript', path: 'b.pdf' },
          a: { slot: 'manuscript', md5: 'aaa', path: 'a.pdf' },
          c: { slot: 'figures', md5: 'ccc', path: 'c.png' },
        },
      }),
    ).toBe('aaa,b.pdf');
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

  it('derives upload check context from current upload analysis metadata', () => {
    const metadata = {
      files: {
        a: { slot: 'manuscript', type: 'application/pdf', size: 1, md5: 'source-a' },
      },
      [UPLOAD_ANALYSIS_METADATA_KEY]: {
        source: 'metadata-preview',
        sourceSignature: 'source-a',
        document: { images: 'absent' },
        metadata: { title: 'present', authors: 'absent', affiliations: 'unknown' },
      },
    };
    expect(getUploadCheckEligibilityContext(metadata)).toEqual({
      document: { images: 'absent' },
      metadata: { title: 'present', authors: 'absent', affiliations: 'unknown' },
    });
  });

  it('treats missing or stale upload analysis metadata as unknown', () => {
    expect(getUploadCheckEligibilityContext({ files: {} })).toEqual({
      document: { images: 'unknown' },
      metadata: { title: 'unknown', authors: 'unknown', affiliations: 'unknown' },
    });
    expect(
      getUploadCheckEligibilityContext({
        files: {
          a: { slot: 'manuscript', type: 'application/pdf', size: 1, md5: 'source-a' },
        },
        [UPLOAD_ANALYSIS_METADATA_KEY]: {
          sourceSignature: 'old-source',
          document: { images: 'absent' },
          metadata: { title: 'present' },
        },
      }),
    ).toEqual({
      document: { images: 'unknown' },
      metadata: { title: 'unknown', authors: 'unknown', affiliations: 'unknown' },
    });
  });

  it('passes upload check context into eligibility predicates', () => {
    const services = [
      {
        id: 'proofig',
        isUploadEligible: (_metadata: unknown, context?: UploadCheckEligibilityContext) =>
          context?.document.images !== 'absent',
      },
    ];
    const metadata = {
      files: {
        a: { slot: 'manuscript', type: 'application/pdf', size: 1, md5: 'source-a' },
      },
      [UPLOAD_ANALYSIS_METADATA_KEY]: {
        sourceSignature: 'source-a',
        document: { images: 'absent' },
      },
    };
    expect(hasInvalidEnabledUploadChecks(metadata, ['proofig'], services)).toBe(true);
  });

  it('maps extracted values to upload fact presence', () => {
    expect(uploadFactPresenceFromValue('Title')).toBe('present');
    expect(uploadFactPresenceFromValue('')).toBe('absent');
    expect(uploadFactPresenceFromValue([{ name: 'Ada' }])).toBe('present');
    expect(uploadFactPresenceFromValue([])).toBe('absent');
    expect(uploadFactPresenceFromValue(undefined)).toBe('absent');
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
        'checks-text-integrity': { underMaintenance: true },
      }),
    ).toBe(true);
    expect(
      hasMaintenanceEnabledUploadChecks(['checks-text-integrity'], {
        proofig: { underMaintenance: true },
      }),
    ).toBe(false);
  });
});
