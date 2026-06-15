// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { buildSubmissionMetadataWithSupersedes } from './register-work-lineage.js';

describe('buildSubmissionMetadataWithSupersedes', () => {
  test('adds forward link under venue key', () => {
    expect(
      buildSubmissionMetadataWithSupersedes(
        {
          biorxiv: {
            version: 'v1',
            source_key: 'key.meca',
          },
        },
        'biorxiv',
        'old-sv-uuid',
      ),
    ).toEqual({
      biorxiv: {
        version: 'v1',
        source_key: 'key.meca',
        supersedes: 'old-sv-uuid',
      },
    });
  });
});
