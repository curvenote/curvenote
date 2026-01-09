// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect } from 'vitest';
import { formatDate } from './formatDate.js';

describe('formatDate', () => {
  describe('with date string in YYYY-M-D format', () => {
    it('should format single digit month and day', () => {
      const result = formatDate('2023-1-5');
      expect(result).toBe('Jan 05, 2023');
    });

    it('should format double digit month and day', () => {
      const result = formatDate('2023-12-25');
      expect(result).toBe('Dec 25, 2023');
    });

    it('should format with custom format string', () => {
      const result = formatDate('2023-6-15', 'yyyy-MM-dd');
      expect(result).toBe('2023-06-15');
    });

    it('should handle mixed single and double digits', () => {
      const result = formatDate('2023-1-25');
      expect(result).toBe('Jan 25, 2023');
    });
  });

  describe('with ISO date string', () => {
    it('should format ISO date string with default format', () => {
      const result = formatDate('2023-06-15T10:30:00Z');
      expect(result).toBe('Jun 15, 2023');
    });

    it('should format ISO date string with custom format', () => {
      const result = formatDate('2023-06-15T10:30:00Z', 'dd/MM/yyyy');
      expect(result).toBe('15/06/2023');
    });
  });

  describe('with various date formats', () => {
    it('should format date with time', () => {
      const result = formatDate('2023-06-15 14:30:00', 'MMM dd, y HH:mm');
      expect(result).toBe('Jun 15, 2023 14:30');
    });

    it('should use default format when none provided', () => {
      const result = formatDate('2023-06-15');
      expect(result).toBe('Jun 15, 2023');
    });
  });

  describe('with invalid dates', () => {
    it('should return empty string for invalid date string', () => {
      const result = formatDate('invalid-date');
      expect(result).toBe('');
    });

    it('should return empty string for empty string', () => {
      const result = formatDate('');
      expect(result).toBe('');
    });

    it('should return empty string for whitespace only', () => {
      const result = formatDate('   ');
      expect(result).toBe('');
    });

    it('should return empty string for invalid month (0)', () => {
      const result = formatDate('2023-00-15');
      expect(result).toBe('');
    });

    it('should return empty string for invalid month (13)', () => {
      const result = formatDate('2023-13-15');
      expect(result).toBe('');
    });

    it('should return empty string for invalid day (0)', () => {
      const result = formatDate('2023-06-00');
      expect(result).toBe('');
    });

    it('should return empty string for invalid day (32)', () => {
      const result = formatDate('2023-06-32');
      expect(result).toBe('');
    });

    it('should return empty string for February 30th', () => {
      const result = formatDate('2023-02-30');
      expect(result).toBe('');
    });

    it('should return empty string for invalid year', () => {
      const result = formatDate('0999-06-15');
      expect(result).toBe('');
    });

    it('should handle valid leap year date', () => {
      const result = formatDate('2024-02-29');
      expect(result).toBe('Feb 29, 2024');
    });

    it('should return empty string for invalid leap year date', () => {
      const result = formatDate('2023-02-29');
      expect(result).toBe('');
    });
  });
});
