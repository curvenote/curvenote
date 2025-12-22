// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect } from 'vitest';
import { summarizeAuthors } from './authors.js';

describe('summarizeAuthors', () => {
  describe('formats by display option', () => {
    it('formats surname only (default)', () => {
      const authors = [
        { family: 'Duan', given: 'Yun' },
        { family: 'He', given: 'Li' },
      ];
      expect(summarizeAuthors(authors)).toBe('Duan, He');
    });

    it('formats initials', () => {
      const authors = [
        { family: 'Smith', given: 'John Kevin' },
        { family: 'Doe', given: 'Jane' },
      ];
      expect(summarizeAuthors(authors, { display: 'initials' })).toBe('Smith, J. K., Doe, J.');
    });

    it('formats full names', () => {
      const authors = [
        { family: 'Brown', given: 'Charlie' },
        { family: 'White', given: 'Betty Lou' },
      ];
      expect(summarizeAuthors(authors, { display: 'full' })).toBe(
        'Brown, Charlie, White, Betty Lou',
      );
    });
  });

  describe('handles different author object shapes', () => {
    it('family/given', () => {
      const authors = [
        { family: 'Duan', given: 'Yun' },
        { family: 'He', given: 'Li' },
      ];
      expect(summarizeAuthors(authors)).toBe('Duan, He');
    });

    it('lastName/firstName', () => {
      const authors = [
        { lastName: 'Nguyen', firstName: 'Minh' },
        { lastName: 'Tran', firstName: 'An' },
      ];
      expect(summarizeAuthors(authors)).toBe('Nguyen, Tran');
      expect(summarizeAuthors(authors, { display: 'initials' })).toBe('Nguyen, M., Tran, A.');
    });

    it('surname/firstName', () => {
      const authors = [{ surname: 'Kim', firstName: 'Soo' }];
      expect(summarizeAuthors(authors)).toBe('Kim');
      expect(summarizeAuthors(authors, { display: 'full' })).toBe('Kim, Soo');
    });
  });

  describe('parses name field', () => {
    it('parses name: "Last, First Middle"', () => {
      const authors = [{ name: 'Garcia, Maria Elena' }];
      expect(summarizeAuthors(authors, { display: 'initials' })).toBe('Garcia, M. E.');
      expect(summarizeAuthors(authors, { display: 'full' })).toBe('Garcia, Maria Elena');
    });

    it('parses name: "First Middle Last"', () => {
      const authors = [{ name: 'Anna Belle Lee' }];
      expect(summarizeAuthors(authors, { display: 'surname' })).toBe('Lee');
      expect(summarizeAuthors(authors, { display: 'initials' })).toBe('Lee, A. B.');
    });

    it('parses name: "SingleName"', () => {
      const authors = [{ name: 'Plato' }];
      expect(summarizeAuthors(authors)).toBe('Plato');
      expect(summarizeAuthors(authors, { display: 'initials' })).toBe('Plato');
    });

    it('parses abbreviated name: "Smith, J."', () => {
      const authors = [{ name: 'Smith, J.' }];
      expect(summarizeAuthors(authors, { display: 'surname' })).toBe('Smith');
      expect(summarizeAuthors(authors, { display: 'initials' })).toBe('Smith, J.');
      expect(summarizeAuthors(authors, { display: 'full' })).toBe('Smith, J.');
    });

    it('parses abbreviated name: "J. Smith"', () => {
      const authors = [{ name: 'J. Smith' }];
      expect(summarizeAuthors(authors, { display: 'surname' })).toBe('Smith');
      expect(summarizeAuthors(authors, { display: 'initials' })).toBe('Smith, J.');
      expect(summarizeAuthors(authors, { display: 'full' })).toBe('Smith, J.');
    });

    it('parses abbreviated name: "J. K. Rowling"', () => {
      const authors = [{ name: 'J. K. Rowling' }];
      expect(summarizeAuthors(authors, { display: 'surname' })).toBe('Rowling');
      expect(summarizeAuthors(authors, { display: 'initials' })).toBe('Rowling, J. K.');
      expect(summarizeAuthors(authors, { display: 'full' })).toBe('Rowling, J. K.');
    });

    it('parses abbreviated name: "Rowling, J. K."', () => {
      const authors = [{ name: 'Rowling, J. K.' }];
      expect(summarizeAuthors(authors, { display: 'surname' })).toBe('Rowling');
      expect(summarizeAuthors(authors, { display: 'initials' })).toBe('Rowling, J. K.');
      expect(summarizeAuthors(authors, { display: 'full' })).toBe('Rowling, J. K.');
    });
  });

  describe('edge cases', () => {
    it('shows Unknown for missing names', () => {
      const authors = [{}, { firstName: 'OnlyFirst' }];
      expect(summarizeAuthors(authors)).toBe('Unknown, Unknown');
    });

    it('returns empty string for empty array', () => {
      expect(summarizeAuthors([])).toBe('');
    });

    it('returns Unknown for all missing/unknown authors', () => {
      const authors = [{}, {}];
      expect(summarizeAuthors(authors)).toBe('Unknown, Unknown');
    });
  });

  describe('summarizing', () => {
    it('summarizes with +N more authors', () => {
      const authors = [
        { family: 'Duan', given: 'Yun' },
        { family: 'He', given: 'Li' },
        { family: 'Smith', given: 'John' },
        { family: 'Doe', given: 'Jane' },
      ];
      expect(summarizeAuthors(authors, { maxDisplay: 2 })).toBe('Duan, He, +2 more authors');
      expect(summarizeAuthors(authors, { maxDisplay: 3 })).toBe('Duan, He, Smith, +1 more authors');
    });

    it('shows all if authors.length <= maxDisplay', () => {
      const authors = [
        { family: 'Duan', given: 'Yun' },
        { family: 'He', given: 'Li' },
      ];
      expect(summarizeAuthors(authors, { maxDisplay: 2 })).toBe('Duan, He');
    });
  });
});
