/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect } from 'vitest';
import { workActivityDataForJob } from '../../src/backend/jobs/run/workActivityDataForJob.server.js';

describe('workActivityDataForJob', () => {
  test('builds converter data for CONVERTER_TASK_STARTED', () => {
    expect(
      workActivityDataForJob('CONVERTER_TASK_STARTED', {
        work_version_id: 'wv-1',
        target: 'pdf',
        conversion_type: 'docx-pandoc-myst-pdf',
      }),
    ).toEqual({
      converter: { target: 'pdf', type: 'docx-pandoc-myst-pdf' },
    });
  });

  test('uses converter defaults when target and conversion_type are absent', () => {
    expect(workActivityDataForJob('CONVERTER_TASK_STARTED', { work_version_id: 'wv-1' })).toEqual({
      converter: { target: 'pdf', type: 'docx-pandoc-myst-pdf' },
    });
  });

  test('uses converter defaults when target and conversion_type are non-string', () => {
    expect(
      workActivityDataForJob('CONVERTER_TASK_STARTED', {
        work_version_id: 'wv-1',
        target: 42,
        conversion_type: null,
      }),
    ).toEqual({
      converter: { target: 'pdf', type: 'docx-pandoc-myst-pdf' },
    });
  });

  test('returns check payload for CHECK_STARTED', () => {
    expect(
      workActivityDataForJob('CHECK_STARTED', {
        work_version_id: 'wv-1',
        check: { kind: 'curvenote-structure' },
      }),
    ).toEqual({
      check: { kind: 'curvenote-structure' },
    });
  });

  test('returns undefined for CHECK_STARTED when check is missing', () => {
    expect(workActivityDataForJob('CHECK_STARTED', { work_version_id: 'wv-1' })).toBeUndefined();
  });

  test('returns undefined when activity type is null or undefined', () => {
    expect(workActivityDataForJob(null, { work_version_id: 'wv-1' })).toBeUndefined();
    expect(workActivityDataForJob(undefined, { work_version_id: 'wv-1' })).toBeUndefined();
  });

  test('returns undefined for unknown activity types', () => {
    expect(workActivityDataForJob('UNKNOWN_ACTIVITY', { work_version_id: 'wv-1' })).toBeUndefined();
  });
});
