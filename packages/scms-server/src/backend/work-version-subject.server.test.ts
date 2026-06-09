/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect } from 'vitest';
import {
  WORK_VERSION_SUBJECT_JSON_PATH,
  WORK_VERSION_SUBJECT_NORMALIZED_FN,
  extractWorkVersionSubjectFromMetadata,
} from './work-version-subject.server.js';

describe('WORK_VERSION_SUBJECT_JSON_PATH', () => {
  test('is a quoted SQL text-array literal for Prisma.raw()', () => {
    expect(WORK_VERSION_SUBJECT_JSON_PATH).toBe("'{frontmatter.myst,subject}'");
  });
});

describe('WORK_VERSION_SUBJECT_NORMALIZED_FN', () => {
  test('matches the Postgres function backing WorkVersion_subject_normalized_idx', () => {
    expect(WORK_VERSION_SUBJECT_NORMALIZED_FN).toBe('work_version_subject_normalized');
  });
});

describe('extractWorkVersionSubjectFromMetadata', () => {
  test('reads frontmatter.myst.subject', () => {
    expect(
      extractWorkVersionSubjectFromMetadata({
        'frontmatter.myst': {
          subject: ' Neuroscience ',
        },
      }),
    ).toBe('Neuroscience');
  });

  test('returns undefined for missing or empty values', () => {
    expect(extractWorkVersionSubjectFromMetadata(null)).toBeUndefined();
    expect(extractWorkVersionSubjectFromMetadata({})).toBeUndefined();
    expect(
      extractWorkVersionSubjectFromMetadata({
        'frontmatter.myst': { subject: '   ' },
      }),
    ).toBeUndefined();
    expect(
      extractWorkVersionSubjectFromMetadata({
        myst: {
          frontmatter: {
            project: { subject: 'Neuroscience' },
          },
        },
      }),
    ).toBeUndefined();
  });
});
