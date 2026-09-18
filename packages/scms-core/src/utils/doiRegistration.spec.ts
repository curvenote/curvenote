// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { DOI_DEPOSIT_STATUS, DOI_REGISTRATION_STATUS } from './doiRegistration.js';

describe('DOI registration constants', () => {
  test('registration status matches the values documented on DoiRegistration.status', () => {
    expect(Object.values(DOI_REGISTRATION_STATUS)).toEqual([
      'DRAFT',
      'SUBMITTING',
      'REGISTERED',
      'FAILED',
    ]);
  });

  test('deposit status matches the values documented on DoiDeposit.status', () => {
    expect(Object.values(DOI_DEPOSIT_STATUS)).toEqual([
      'PENDING',
      'QUEUED',
      'SUCCEEDED',
      'FAILED',
    ]);
  });
});
