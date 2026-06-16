/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  isLocalMockQueueDeliveryEnabled,
  resetJobQueueProviderCache,
  resolveQueueProviderName,
} from '../../src/backend/jobs/enqueue/queueProviders/index.server.js';

describe('queue provider selection', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetJobQueueProviderCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetJobQueueProviderCache();
  });

  test('mock provider enables local loopback delivery regardless of NODE_ENV', () => {
    process.env.QUEUES_PROVIDER = 'mock';
    process.env.NODE_ENV = 'production';
    delete process.env.VERCEL;

    expect(resolveQueueProviderName()).toBe('mock');
    expect(isLocalMockQueueDeliveryEnabled()).toBe(true);
  });

  test('vercel provider disables local loopback delivery', () => {
    process.env.QUEUES_PROVIDER = 'vercel';
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL;

    expect(resolveQueueProviderName()).toBe('vercel');
    expect(isLocalMockQueueDeliveryEnabled()).toBe(false);
  });
});
