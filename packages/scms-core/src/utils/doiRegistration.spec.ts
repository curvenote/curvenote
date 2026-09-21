// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import {
  DOI_DEPOSIT_STATUS,
  DOI_REGISTRATION_STATUS,
  resolveSiteWorkDoi,
} from './doiRegistration.js';

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
    expect(Object.values(DOI_DEPOSIT_STATUS)).toEqual(['PENDING', 'QUEUED', 'SUCCEEDED', 'FAILED']);
  });
});

describe('resolveSiteWorkDoi', () => {
  test('the registered submission DOI wins over both work DOIs', () => {
    expect(
      resolveSiteWorkDoi({
        submission: '10.62329/cn-a',
        workVersion: '10.5555/work-a',
        work: '10.5555/work-b',
      }),
    ).toBe('10.62329/cn-a');
  });

  test('falls back to the work version DOI, then the work DOI', () => {
    expect(
      resolveSiteWorkDoi({ submission: null, workVersion: '10.5555/work-a', work: '10.5555/b' }),
    ).toBe('10.5555/work-a');
    expect(resolveSiteWorkDoi({ submission: null, workVersion: null, work: '10.5555/b' })).toBe(
      '10.5555/b',
    );
  });

  test('normalises the absence of every source to undefined', () => {
    expect(resolveSiteWorkDoi({ submission: null, workVersion: null, work: null })).toBeUndefined();
    expect(resolveSiteWorkDoi({ submission: null, workVersion: null })).toBeUndefined();
  });
});
