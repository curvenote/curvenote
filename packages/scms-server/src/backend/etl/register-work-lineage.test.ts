// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import {
  applySupersededToSubmissionMetadata,
  buildSubmissionMetadataWithSupersedes,
} from './register-work-lineage.js';

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
        supersedes_submission_version_id: 'old-sv-uuid',
      },
    });
  });
});

describe('applySupersededToSubmissionMetadata', () => {
  test('keeps version and adds backward link on old row', () => {
    expect(
      applySupersededToSubmissionMetadata(
        {
          biorxiv: {
            version: 'v1',
            source_key: 'key.meca',
          },
        },
        'biorxiv',
        'new-sv-uuid',
        '2026-06-10T12:00:00Z',
      ),
    ).toEqual({
      biorxiv: {
        version: 'v1',
        source_key: 'key.meca',
        superseded_by_submission_version_id: 'new-sv-uuid',
        superseded_at: '2026-06-10T12:00:00Z',
      },
    });
  });

  test('creates venue block when metadata was empty', () => {
    expect(
      applySupersededToSubmissionMetadata(null, 'medrxiv', 'new-sv-uuid', '2026-06-10T12:00:00Z'),
    ).toEqual({
      medrxiv: {
        superseded_by_submission_version_id: 'new-sv-uuid',
        superseded_at: '2026-06-10T12:00:00Z',
      },
    });
  });
});
