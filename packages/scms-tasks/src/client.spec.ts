// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect } from 'vitest';
import { SCMSClient } from './client';

describe('scms-tasks client', () => {
  it('should be defined', () => {
    expect(SCMSClient).toBeDefined();
  });
});
