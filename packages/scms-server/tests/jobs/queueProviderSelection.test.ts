/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
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

  test('mock provider in explicit mock mode', () => {
    process.env.QUEUES_PROVIDER = 'mock';
    process.env.NODE_ENV = 'production';
    delete process.env.VERCEL;

    expect(resolveQueueProviderName()).toBe('mock');
  });

  test('supabase provider when VERCEL=1', () => {
    process.env.QUEUES_PROVIDER = 'supabase';
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL;

    expect(resolveQueueProviderName()).toBe('supabase');
  });

  test('defaults to supabase on Vercel', () => {
    delete process.env.QUEUES_PROVIDER;
    process.env.VERCEL = '1';

    expect(resolveQueueProviderName()).toBe('supabase');
  });
});
