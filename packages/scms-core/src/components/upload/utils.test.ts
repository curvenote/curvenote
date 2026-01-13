// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect } from 'vitest';
import { generateFileLabel, generateUniqueFileLabel } from '../../backend/uploads/utils.js';

describe('generateFileLabel', () => {
  it('should remove file extension', () => {
    expect(generateFileLabel('document.pdf')).toBe('document');
    expect(generateFileLabel('image.jpg')).toBe('image');
    expect(generateFileLabel('data.xlsx')).toBe('data');
  });

  it('should preserve spaces but remove other whitespace', () => {
    expect(generateFileLabel('my document.pdf')).toBe('my document');
    expect(generateFileLabel('  spaced  file  .txt')).toBe('  spaced  file  ');
    expect(generateFileLabel('file\twith\ttabs.pdf')).toBe('filewithtabs');
    expect(generateFileLabel('file\nwith\nnewlines.pdf')).toBe('filewithnewlines');
    expect(generateFileLabel('file\rwith\rcarriage.pdf')).toBe('filewithcarriage');
  });

  it('should remove special characters but keep underscores', () => {
    expect(generateFileLabel('file@#$%.pdf')).toBe('file');
    expect(generateFileLabel('test-file_123.pdf')).toBe('test-file_123');
  });

  it('should preserve underscores in filenames', () => {
    expect(generateFileLabel('data_analysis.pdf')).toBe('data_analysis');
    expect(generateFileLabel('figure_1_supplement.png')).toBe('figure_1_supplement');
    expect(generateFileLabel('my_file_with_underscores.docx')).toBe('my_file_with_underscores');
  });

  it('should limit to 100 characters', () => {
    const longName = 'a'.repeat(150) + '.pdf';
    expect(generateFileLabel(longName)).toHaveLength(100);
  });

  it('should return untitled for empty result', () => {
    expect(generateFileLabel('...')).toBe('untitled');
    expect(generateFileLabel('')).toBe('untitled');
  });
});

describe('generateUniqueFileLabel', () => {
  it('should return original label if no conflicts', () => {
    const existingLabels = new Set<string>();
    expect(generateUniqueFileLabel('test.pdf', existingLabels)).toBe('test');
  });

  it('should add number suffix for conflicts', () => {
    const existingLabels = new Set<string>(['test']);
    expect(generateUniqueFileLabel('test.pdf', existingLabels)).toBe('test1');
  });

  it('should handle multiple conflicts', () => {
    const existingLabels = new Set<string>(['test', 'test1', 'test2']);
    expect(generateUniqueFileLabel('test.pdf', existingLabels)).toBe('test3');
  });

  it('should truncate base label if needed for counter', () => {
    const longBase = 'a'.repeat(98);
    const existingLabels = new Set<string>([longBase]);
    const result = generateUniqueFileLabel(longBase + '.pdf', existingLabels);
    expect(result).toBe('a'.repeat(95) + '1');
  });
});

describe('File ordering', () => {
  it('should sort files by order field with backward compatibility', () => {
    const files = [
      { path: 'file1.pdf', order: 2, uploadDate: '2025-01-15T10:30:00Z' },
      { path: 'file2.pdf', order: 1, uploadDate: '2025-01-15T10:25:00Z' },
      { path: 'file3.pdf', order: undefined, uploadDate: '2025-01-15T10:35:00Z' },
      { path: 'file4.pdf', order: undefined, uploadDate: '2025-01-15T10:20:00Z' },
    ];

    const sorted = files.sort((a, b) => {
      // Sort by order field if available, otherwise by uploadDate
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // Fallback to uploadDate if order is not available (backward compatibility)
      const dateA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
      const dateB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
      return dateA - dateB;
    });

    // Expected order: files with order=0 (undefined) sorted by date first, then files with explicit order
    // file4 (order: 0, date: 10:20), file3 (order: 0, date: 10:35), file2 (order: 1), file1 (order: 2)
    expect(sorted.map((f) => f.path)).toEqual(['file4.pdf', 'file3.pdf', 'file2.pdf', 'file1.pdf']);
  });

  it('should detect duplicate files within the same slot', () => {
    const existingFiles = [
      { slot: 'abc/figures', name: 'figure1.png', md5: 'abc123', path: 'path/to/figure1.png' },
      { slot: 'abc/figures', name: 'figure2.png', md5: 'def456', path: 'path/to/figure2.png' },
      {
        slot: 'abc/manuscript',
        name: 'manuscript.docx',
        md5: 'abc123',
        path: 'path/to/manuscript.docx',
      }, // Same MD5 as figure1
    ];

    const newFiles = [
      { path: 'path/to/figure1.png', md5: 'abc123', content_type: 'image/png' }, // Duplicate by MD5
      { path: 'path/to/figure3.png', md5: 'ghi789', content_type: 'image/png' }, // New file
      { path: 'path/to/figure2.png', md5: 'jkl012', content_type: 'image/png' }, // Duplicate by name
    ];

    const slot = 'abc/figures';
    const existingFilesInSlot = existingFiles.filter((file) => file.slot === slot);

    const duplicates = newFiles.filter((newFile) => {
      const fileName = newFile.path.split('/').pop() || '';

      // Check for duplicate by MD5 hash
      const duplicateByHash = existingFilesInSlot.find((existing) => existing.md5 === newFile.md5);
      if (duplicateByHash) return true;

      // Check for duplicate by filename
      const duplicateByName = existingFilesInSlot.find((existing) => existing.name === fileName);
      if (duplicateByName) return true;

      return false;
    });

    expect(duplicates).toHaveLength(2);
    expect(duplicates[0].path).toBe('path/to/figure1.png'); // Duplicate by MD5
    expect(duplicates[1].path).toBe('path/to/figure2.png'); // Duplicate by name
  });
});
