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
});
