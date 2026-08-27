// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { formatPublicationDate } from './publicationDateCalendar.js';

describe('formatPublicationDate', () => {
  it('formats an ISO date as day month year', () => {
    expect(formatPublicationDate('2024-08-27')).toBe('27 August 2024');
  });
});
