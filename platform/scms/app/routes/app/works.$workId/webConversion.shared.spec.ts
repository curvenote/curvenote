// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEB_CONVERSION_TYPE,
  findInFlightWebConversionJob,
  isWebConversionPayload,
  isWebConversionType,
  resolveRetryWebConversionTypeFromLinkedJobs,
  resolveWebConversionTypeForRetry,
} from './webConversion.shared';

describe('webConversion.shared', () => {
  it('matches any converter payload with target web', () => {
    expect(isWebConversionPayload({ target: 'web', conversion_type: 'myst-curvenote-web' })).toBe(
      true,
    );
    expect(
      isWebConversionPayload({ target: 'web', conversion_type: 'docx-pd-curvenote-web' }),
    ).toBe(true);
    expect(isWebConversionPayload({ target: 'web', conversion_type: 'docx-pandoc-myst-web' })).toBe(
      true,
    );
    expect(isWebConversionPayload({ target: 'web' })).toBe(true);
    expect(
      isWebConversionPayload({ target: 'pdf', conversion_type: 'docx-pd-curvenote-pdf' }),
    ).toBe(false);
  });

  it('recognizes known web conversion types and legacy aliases', () => {
    expect(isWebConversionType('myst-curvenote-web')).toBe(true);
    expect(isWebConversionType('docx-pd-curvenote-web')).toBe(true);
    expect(isWebConversionType('docx-pandoc-myst-web')).toBe(true);
    expect(isWebConversionType('docx-pd-curvenote-pdf')).toBe(false);
    expect(isWebConversionType('not-a-type')).toBe(false);
  });

  it('resolves retry conversion_type from the failed job, canonicalizing aliases', () => {
    expect(
      resolveWebConversionTypeForRetry({
        target: 'web',
        conversion_type: 'docx-pd-curvenote-web',
      }),
    ).toBe('docx-pd-curvenote-web');
    expect(
      resolveWebConversionTypeForRetry({
        target: 'web',
        conversion_type: 'docx-pandoc-myst-web',
      }),
    ).toBe('docx-pd-curvenote-web');
    expect(
      resolveWebConversionTypeForRetry({
        target: 'web',
        conversion_type: 'myst-curvenote-web',
      }),
    ).toBe('myst-curvenote-web');
    expect(resolveWebConversionTypeForRetry({ target: 'web' })).toBe(DEFAULT_WEB_CONVERSION_TYPE);
    expect(
      resolveWebConversionTypeForRetry({
        target: 'web',
        conversion_type: 'docx-pd-curvenote-pdf',
      }),
    ).toBe(DEFAULT_WEB_CONVERSION_TYPE);
  });

  it('picks conversion_type from the latest linked web job', () => {
    expect(
      resolveRetryWebConversionTypeFromLinkedJobs([
        {
          job: {
            id: 'old',
            status: 'FAILED',
            job_type: 'CONVERTER_TASK',
            date_created: '2026-09-23T09:00:00.000Z',
            payload: { target: 'web', conversion_type: 'myst-curvenote-web' },
          },
        },
        {
          job: {
            id: 'new',
            status: 'FAILED',
            job_type: 'CONVERTER_TASK',
            date_created: '2026-09-23T11:00:00.000Z',
            payload: { target: 'web', conversion_type: 'docx-pd-curvenote-web' },
          },
        },
        {
          job: {
            id: 'pdf',
            status: 'FAILED',
            job_type: 'CONVERTER_TASK',
            date_created: '2026-09-23T12:00:00.000Z',
            payload: { target: 'pdf', conversion_type: 'docx-pd-curvenote-pdf' },
          },
        },
      ]),
    ).toBe('docx-pd-curvenote-web');
  });

  it('finds in-flight web jobs of any web conversion_type', () => {
    const inFlight = findInFlightWebConversionJob([
      {
        job: {
          id: 'docx',
          status: 'RUNNING',
          job_type: 'CONVERTER_TASK',
          payload: { target: 'web', conversion_type: 'docx-pd-curvenote-web' },
        },
      },
    ]);
    expect(inFlight?.job.id).toBe('docx');
    expect(
      findInFlightWebConversionJob([
        {
          job: {
            id: 'done',
            status: 'FAILED',
            job_type: 'CONVERTER_TASK',
            payload: { target: 'web', conversion_type: 'docx-pd-curvenote-web' },
          },
        },
      ]),
    ).toBeUndefined();
  });
});
