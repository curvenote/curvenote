// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { methodLabel, statusPresentation } from './doi.utils.js';

describe('statusPresentation', () => {
  test.each([
    ['PENDING_ROLE', 'Waiting for Crossref role', 'warning'],
    ['ACTIVE', 'Active', 'success'],
  ])('%s', (status, label, variant) => {
    expect(statusPresentation(status)).toMatchObject({ label, variant });
  });

  test('falls back to a neutral badge for a status it does not know', () => {
    expect(statusPresentation('SOMETHING_NEW')).toMatchObject({
      label: 'SOMETHING_NEW',
      variant: 'neutral',
    });
  });
});

describe('methodLabel', () => {
  test('names both modes as the design does', () => {
    expect(methodLabel('CURVENOTE_PREFIX')).toBe('Curvenote-managed');
    expect(methodLabel('CUSTOM_PREFIX')).toBe('Organization-managed');
  });
});
