// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect } from 'vitest';
import { matchesWildcard } from './wildcard.js';

describe('matchesWildcard', () => {
  describe('exact matches', () => {
    it('should match identical strings', () => {
      expect(matchesWildcard('extensions', 'extensions')).toBe(true);
      expect(matchesWildcard('name', 'name')).toBe(true);
      expect(matchesWildcard('', '')).toBe(true);
    });

    it('should not match different strings', () => {
      expect(matchesWildcard('extensions', 'extension')).toBe(false);
      expect(matchesWildcard('name', 'names')).toBe(false);
      expect(matchesWildcard('foo', 'bar')).toBe(false);
    });
  });

  describe('single wildcard (*)', () => {
    it('should match single segment with *', () => {
      expect(matchesWildcard('extensions.foo.name', 'extensions.*.name')).toBe(true);
      expect(matchesWildcard('extensions.bar.name', 'extensions.*.name')).toBe(true);
      expect(matchesWildcard('extensions.123.name', 'extensions.*.name')).toBe(true);
    });

    it('should not match multiple segments with single *', () => {
      expect(matchesWildcard('extensions.foo.bar.name', 'extensions.*.name')).toBe(false);
      expect(matchesWildcard('extensions.foo.bar.baz.name', 'extensions.*.name')).toBe(false);
    });

    it('should not match empty segments with *', () => {
      expect(matchesWildcard('extensions..name', 'extensions.*.name')).toBe(false);
      expect(matchesWildcard('extensions.name', 'extensions.*.name')).toBe(false);
    });

    it('should match at the beginning', () => {
      expect(matchesWildcard('foo.bar', '*.bar')).toBe(false);
      expect(matchesWildcard('baz.bar', '*.bar')).toBe(false);
    });

    it('should match at the end', () => {
      expect(matchesWildcard('foo.bar', 'foo.*')).toBe(true);
      expect(matchesWildcard('foo.baz', 'foo.*')).toBe(true);
    });

    it('should match in the middle', () => {
      expect(matchesWildcard('a.foo.b', 'a.*.b')).toBe(true);
      expect(matchesWildcard('a.bar.b', 'a.*.b')).toBe(true);
    });
  });

  describe('multiple wildcards', () => {
    it('should match multiple single segments', () => {
      expect(matchesWildcard('a.b.c', 'a.*.c')).toBe(true);
      expect(matchesWildcard('a.foo.bar.c', 'a.*.*.c')).toBe(true);
      expect(matchesWildcard('a.b.c.d', 'a.*.c.*')).toBe(true);
    });

    it('should not match when segments count differs', () => {
      expect(matchesWildcard('a.b.c', 'a.*.*.c')).toBe(false);
      expect(matchesWildcard('a.b.c.d', 'a.*.c')).toBe(false);
    });
  });

  describe('special characters and escaping', () => {
    it('should escape regex special characters', () => {
      expect(matchesWildcard('a+b.c', 'a+b.*')).toBe(true);
      expect(matchesWildcard('a.b.c', 'a+b.*')).toBe(false);
      expect(matchesWildcard('a.b.c', 'a.b.*')).toBe(true);
      expect(matchesWildcard('a+b.c', 'a.b.*')).toBe(false);
    });

    it('should handle dots in patterns', () => {
      expect(matchesWildcard('a.b.c', 'a.b.*')).toBe(true);
      expect(matchesWildcard('a.b.c.d', 'a.b.*')).toBe(false);
    });

    it('should handle parentheses in patterns', () => {
      expect(matchesWildcard('a(b).c', 'a(b).*')).toBe(true);
      expect(matchesWildcard('a.c', 'a(b).*')).toBe(false);
    });

    it('should handle square brackets in patterns', () => {
      expect(matchesWildcard('a[b].c', 'a[b].*')).toBe(true);
      expect(matchesWildcard('a.c', 'a[b].*')).toBe(false);
    });

    it('should handle curly braces in patterns', () => {
      expect(matchesWildcard('a{b}.c', 'a{b}.*')).toBe(true);
      expect(matchesWildcard('a.c', 'a{b}.*')).toBe(false);
    });

    it('should handle pipe characters in patterns', () => {
      expect(matchesWildcard('a|b.c', 'a|b.*')).toBe(true);
      expect(matchesWildcard('a.c', 'a|b.*')).toBe(false);
    });

    it('should handle backslashes in patterns', () => {
      expect(matchesWildcard('a\\b.c', 'a\\b.*')).toBe(true);
      expect(matchesWildcard('a.c', 'a\\b.*')).toBe(false);
    });
  });

  describe('real-world examples', () => {
    it('should match extension configuration keys', () => {
      expect(matchesWildcard('extensions.abc.name', 'extensions.*.name')).toBe(true);
      expect(matchesWildcard('extensions.abc.capabilities', 'extensions.*.capabilities')).toBe(
        true,
      );
      expect(matchesWildcard('extensions.auth.name', 'extensions.*.name')).toBe(true);
    });

    it('should not match nested extension keys', () => {
      expect(matchesWildcard('extensions.abc.config.name', 'extensions.*.name')).toBe(false);
      expect(
        matchesWildcard('extensions.abc.settings.capabilities', 'extensions.*.capabilities'),
      ).toBe(false);
    });

    it('should match nested object properties', () => {
      expect(matchesWildcard('branding.title', 'branding.*')).toBe(true);
      expect(matchesWildcard('branding.logo', 'branding.*')).toBe(true);
      expect(matchesWildcard('statusBar.reportProblem.email', 'statusBar.*.email')).toBe(true);
    });

    it('should not match deeply nested properties with single wildcard', () => {
      expect(matchesWildcard('statusBar.reportProblem.settings.email', 'statusBar.*.email')).toBe(
        false,
      );
      expect(matchesWildcard('branding.logo.dark', 'branding.*')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      expect(matchesWildcard('', '')).toBe(true);
      expect(matchesWildcard('', '*')).toBe(false);
      expect(matchesWildcard('a', '')).toBe(false);
    });

    it('should handle patterns with only wildcards', () => {
      expect(matchesWildcard('a', '*')).toBe(false);
      expect(matchesWildcard('a.b', '*')).toBe(false);
      expect(matchesWildcard('a.b', '*.*')).toBe(false);
    });

    it('should handle patterns with no wildcards', () => {
      expect(matchesWildcard('a.b.c', 'a.b.c')).toBe(true);
      expect(matchesWildcard('a.b', 'a.b.c')).toBe(false);
      expect(matchesWildcard('a.b.c.d', 'a.b.c')).toBe(false);
    });

    it('should handle consecutive dots', () => {
      expect(matchesWildcard('a..b', 'a.*.b')).toBe(false);
      expect(matchesWildcard('a.b', 'a..b')).toBe(false);
    });

    it('should handle leading and trailing dots', () => {
      expect(matchesWildcard('.a.b', '.*.b')).toBe(false);
      expect(matchesWildcard('a.b.', 'a.*.')).toBe(false);
      expect(matchesWildcard('a.b', '.a.b')).toBe(false);
      expect(matchesWildcard('a.b', 'a.b.')).toBe(false);
    });
  });

  describe('performance and complex patterns', () => {
    it('should handle long keys efficiently', () => {
      const longKey = 'a'.repeat(1000) + '.b.' + 'c'.repeat(1000);
      const pattern = 'a*.*.c*';
      expect(matchesWildcard(longKey, pattern)).toBe(true);
    });

    it('should handle patterns with many wildcards', () => {
      expect(matchesWildcard('a.b.c.d.e.f', 'a.*.c.*.e.*')).toBe(true);
      expect(matchesWildcard('a.b.c.d.e.f.g', 'a.*.c.*.e.*')).toBe(false);
    });
  });
});
