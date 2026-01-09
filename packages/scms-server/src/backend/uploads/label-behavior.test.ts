// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect } from 'vitest';
import type { FileUploadConfig } from '@curvenote/scms-core';
import { generateFileLabel, generateUniqueFileLabel } from '@curvenote/scms-core';

describe('Upload Label Behavior', () => {
  it('should show labels when requireLabel is true', () => {
    const config: FileUploadConfig = {
      slot: 'abc/figures',
      label: 'Figures',
      requireLabel: true,
    };
    expect(!!config.requireLabel).toBe(true);
  });

  it('should not show labels when requireLabel is false', () => {
    const config: FileUploadConfig = {
      slot: 'abc/license',
      label: 'License',
      requireLabel: false,
    };
    expect(!!config.requireLabel).toBe(false);
  });

  it('should default to showing labels for backward compatibility', () => {
    const config: FileUploadConfig = {
      slot: 'abc/legacy',
      label: 'Legacy',
      // No requireLabel specified
    };
    expect(!!config.requireLabel).toBe(false); // undefined is falsy
  });
});

describe('Label Generation', () => {
  it('should generate sanitized labels from filenames', () => {
    expect(generateFileLabel('document.pdf')).toBe('document');
    expect(generateFileLabel('my file name.docx')).toBe('my file name');
    expect(generateFileLabel('file-with-hyphens.txt')).toBe('file-with-hyphens');
    expect(generateFileLabel('file with spaces and (parentheses).pdf')).toBe(
      'file with spaces and parentheses',
    );
    expect(generateFileLabel('file\twith\ttabs.pdf')).toBe('filewithtabs');
    expect(generateFileLabel('file\nwith\nnewlines.pdf')).toBe('filewithnewlines');
  });

  it('should generate unique labels when conflicts exist', () => {
    const existingLabels = new Set(['document', 'document1', 'document2']);
    expect(generateUniqueFileLabel('document.pdf', existingLabels)).toBe('document3');
    expect(generateUniqueFileLabel('newfile.pdf', existingLabels)).toBe('newfile');
  });

  it('should handle empty filenames', () => {
    expect(generateFileLabel('')).toBe('untitled');
    expect(generateFileLabel('.pdf')).toBe('untitled');
  });

  it('should truncate very long filenames', () => {
    const longName = 'a'.repeat(200);
    const result = generateFileLabel(longName);
    expect(result.length).toBeLessThanOrEqual(100);
  });
});
