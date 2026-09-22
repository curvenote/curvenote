// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { DepositIssue } from '../../backend/deposit/types.js';
import { isReady, previewFileName, sortIssues, xmlDataUrl } from './readiness.js';

const warn = (code: string): DepositIssue => ({ severity: 'warning', code, message: code });
const block = (code: string): DepositIssue => ({ severity: 'blocking', code, message: code });

describe('sortIssues', () => {
  it('puts blocking issues first and keeps the order within a severity', () => {
    const sorted = sortIssues([warn('w1'), block('b1'), warn('w2'), block('b2')]);
    expect(sorted.map((i) => i.code)).toEqual(['b1', 'b2', 'w1', 'w2']);
  });

  it('does not mutate its input', () => {
    const input = [warn('w1'), block('b1')];
    sortIssues(input);
    expect(input.map((i) => i.code)).toEqual(['w1', 'b1']);
  });
});

describe('isReady', () => {
  it('is true with no issues or only warnings', () => {
    expect(isReady([])).toBe(true);
    expect(isReady([warn('w1')])).toBe(true);
  });

  it('is false with any blocking issue', () => {
    expect(isReady([warn('w1'), block('b1')])).toBe(false);
  });
});

describe('previewFileName', () => {
  it('names the download after the submission', () => {
    expect(previewFileName('sub-1')).toBe('sub-1.deposit-preview.xml');
  });
});

describe('xmlDataUrl', () => {
  it('encodes the XML as a data URL the browser can download', () => {
    const url = xmlDataUrl('<a b="1">&</a>');
    expect(url).toBe('data:application/xml;charset=utf-8,%3Ca%20b%3D%221%22%3E%26%3C%2Fa%3E');
  });
});
