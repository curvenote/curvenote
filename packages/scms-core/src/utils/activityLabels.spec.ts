// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, test, expect } from 'vitest';
import { ACTIVITY_TYPE_LABELS } from './activityLabels.js';

describe('ACTIVITY_TYPE_LABELS', () => {
  test('labels the submission tags change', () => {
    expect(ACTIVITY_TYPE_LABELS.SUBMISSION_TAGS_CHANGE).toBe('Submission tags changed');
  });
});
