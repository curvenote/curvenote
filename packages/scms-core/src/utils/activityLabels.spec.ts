// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, test, expect } from 'vitest';
import { ACTIVITY_TYPE_LABELS } from './activityLabels.js';

describe('ACTIVITY_TYPE_LABELS', () => {
  test('labels the submission tags change', () => {
    expect(ACTIVITY_TYPE_LABELS.SUBMISSION_TAGS_CHANGE).toBe('Submission tags changed');
  });

  test('labels the DOI registration activities', () => {
    expect(ACTIVITY_TYPE_LABELS.DOI_REGISTRATION_STARTED).toBe('DOI registration started');
    expect(ACTIVITY_TYPE_LABELS.DOI_REGISTRATION_COMPLETED).toBe('DOI registered');
    expect(ACTIVITY_TYPE_LABELS.DOI_REGISTRATION_FAILED).toBe('DOI registration unsuccessful');
  });
});
