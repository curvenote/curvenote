/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect } from 'vitest';
import {
  WORK_VERSION_SUBJECT_JSON_PATH,
  extractWorkVersionSubjectFromMetadata,
} from './work-version-subject.server.js';

describe('WORK_VERSION_SUBJECT_JSON_PATH', () => {
  test('is a quoted SQL text-array literal for Prisma.raw()', () => {
    expect(WORK_VERSION_SUBJECT_JSON_PATH).toBe("'{frontmatter.myst,subject}'");
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
