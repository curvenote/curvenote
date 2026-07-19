// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { UploadCheckEligibilityContext } from '../modules/extensions/types.js';
import {
  WORK_VERSION_DOCX_MIME,
  UPLOAD_ANALYSIS_METADATA_KEY,
  clearUploadAnalysisMetadataFacts,
  computeManuscriptSourceSignature,
  getFilesForSlot,
  getUploadCheckEligibilityContext,
  hasDocxInMetadata,
  hasInvalidEnabledUploadChecks,
  hasPdfInMetadata,
  isDocxOrPdfFile,
  resolveExtensionUploadEligibility,
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

  it('computes manuscript source signatures from preview candidates using md5 or path', () => {
    expect(
      computeManuscriptSourceSignature({
        files: {
          b: { slot: 'manuscript', path: 'b.pdf', type: 'application/pdf' },
          a: { slot: 'manuscript', md5: 'aaa', path: 'a.pdf', type: 'application/pdf' },
          c: { slot: 'figures', md5: 'ccc', path: 'c.png', type: 'image/png' },
        },
      }),
    ).toBe('aaa,b.pdf');
  });

  it('includes preview candidates regardless of upload slot', () => {
    expect(
      computeManuscriptSourceSignature({
        files: {
          supp: {
            slot: 'supplementary',
            md5: 'supp-md5',
            path: 'supp.pdf',
            type: 'application/pdf',
          },
          fig: { slot: 'figures', md5: 'fig-md5', path: 'fig.png', type: 'image/png' },
        },
      }),
    ).toBe('supp-md5');
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

  it('hasInvalidEnabledUploadChecks ignores warning status', () => {
    const services = [
      {
        id: 'proofig',
        resolveUploadEligibility: () => ({
          status: 'warning' as const,
          message: 'No figures detected.',
        }),
      },
    ];
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
        a: {
          slot: 'manuscript',
          path: 'a.pdf',
          type: 'application/pdf',
          size: 1,
          md5: 'source-a',
        },
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

  it('clearUploadAnalysisMetadataFacts drops metadata facts but keeps document facts', () => {
    const metadata = {
      files: {
        a: {
          slot: 'manuscript',
          path: 'a.pdf',
          type: 'application/pdf',
          md5: 'source-a',
        },
      },
      'frontmatter.myst': { title: 'Cached title' },
      [UPLOAD_ANALYSIS_METADATA_KEY]: {
        sourceSignature: 'source-a',
        document: { images: 'present' },
        metadata: { title: 'present', authors: 'absent', affiliations: 'unknown' },
      },
    };

    const cleared = clearUploadAnalysisMetadataFacts(metadata);
    expect(cleared['frontmatter.myst']).toEqual({ title: 'Cached title' });
    expect(cleared[UPLOAD_ANALYSIS_METADATA_KEY]).toEqual({
      sourceSignature: 'source-a',
      document: { images: 'present' },
    });
    expect(getUploadCheckEligibilityContext(cleared)).toEqual({
      document: { images: 'present' },
      metadata: { title: 'unknown', authors: 'unknown', affiliations: 'unknown' },
    });
  });

  it('clearUploadAnalysisMetadataFacts removes upload analysis when only metadata facts exist', () => {
    const metadata = {
      [UPLOAD_ANALYSIS_METADATA_KEY]: {
        sourceSignature: 'source-a',
        metadata: { title: 'present', authors: 'present', affiliations: 'absent' },
      },
    };

    const cleared = clearUploadAnalysisMetadataFacts(metadata);
    expect(cleared[UPLOAD_ANALYSIS_METADATA_KEY]).toBeUndefined();
    expect(getUploadCheckEligibilityContext(cleared)).toEqual({
      document: { images: 'unknown' },
      metadata: { title: 'unknown', authors: 'unknown', affiliations: 'unknown' },
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
          a: {
            slot: 'manuscript',
            path: 'a.pdf',
            type: 'application/pdf',
            size: 1,
            md5: 'source-a',
          },
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

  it('passes upload check context into resolveUploadEligibility', () => {
    const services = [
      {
        id: 'proofig',
        resolveUploadEligibility: (_metadata: unknown, context?: UploadCheckEligibilityContext) =>
          context?.document.images === 'absent'
            ? { status: 'warning' as const, message: 'No figures.' }
            : { status: 'eligible' as const },
      },
    ];
    const metadata = {
      files: {
        a: {
          slot: 'manuscript',
          path: 'a.pdf',
          type: 'application/pdf',
          size: 1,
          md5: 'source-a',
        },
      },
      [UPLOAD_ANALYSIS_METADATA_KEY]: {
        sourceSignature: 'source-a',
        document: { images: 'absent' },
      },
    };
    expect(hasInvalidEnabledUploadChecks(metadata, ['proofig'], services)).toBe(false);
    expect(
      resolveExtensionUploadEligibility(
        services[0],
        metadata,
        getUploadCheckEligibilityContext(metadata),
      ),
    ).toEqual({
      status: 'warning',
      message: 'No figures.',
    });
  });

  it('maps extracted values to upload fact presence', () => {
    expect(uploadFactPresenceFromValue('Title')).toBe('present');
    expect(uploadFactPresenceFromValue('')).toBe('absent');
    expect(uploadFactPresenceFromValue([{ name: 'Ada' }])).toBe('present');
    expect(uploadFactPresenceFromValue([])).toBe('absent');
    expect(uploadFactPresenceFromValue(undefined)).toBe('absent');
  });

  it('resolveUploadCheckCardState maps eligibility status to card modes', () => {
    expect(resolveUploadCheckCardState({ status: 'eligible', enabled: false })).toEqual({
      disabled: false,
      invalid: false,
      warning: false,
    });
    expect(resolveUploadCheckCardState({ status: 'eligible', enabled: true })).toEqual({
      disabled: false,
      invalid: false,
      warning: false,
    });
    expect(resolveUploadCheckCardState({ status: 'warning', enabled: false })).toEqual({
      disabled: false,
      invalid: false,
      warning: true,
    });
    expect(resolveUploadCheckCardState({ status: 'warning', enabled: true })).toEqual({
      disabled: false,
      invalid: false,
      warning: true,
    });
    expect(resolveUploadCheckCardState({ status: 'ineligible', enabled: false })).toEqual({
      disabled: false,
      invalid: false,
      warning: false,
    });
    expect(resolveUploadCheckCardState({ status: 'ineligible', enabled: true })).toEqual({
      disabled: false,
      invalid: true,
      warning: false,
    });
    expect(
      resolveUploadCheckCardState({ status: 'eligible', enabled: false, underMaintenance: true }),
    ).toEqual({
      disabled: true,
      invalid: false,
      warning: false,
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
