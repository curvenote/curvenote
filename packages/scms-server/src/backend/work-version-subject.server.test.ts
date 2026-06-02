/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect } from 'vitest';
import { extractWorkVersionSubjectFromMetadata } from './work-version-subject.server.js';

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
