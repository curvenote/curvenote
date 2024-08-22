import { describe, expect, it } from 'vitest';
import moment from 'moment';
import { formatDate } from './date';

describe('formatDate', () => {
  it('returns an ISO string', () => {
    expect(formatDate(moment.utc('2020-06-01 10:10:30').toDate())).toEqual(
      expect.stringMatching('2020-06-01T10:10:30.000Z'),
    );
  });
});
