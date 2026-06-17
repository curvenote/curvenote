/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  resetMockQueueState,
  mockQueueProvider,
} from '../../src/backend/jobs/enqueue/queueProviders/mock.server.js';

describe('mockQueueProvider', () => {
  beforeEach(() => {
    resetMockQueueState();
  });

  test('returns a messageId and dedupes on idempotencyKey', async () => {
    const message = {
      job_id: 'job-1',
      job_type: 'LOOPBACK',
      handshake: 'token',
    };

    const first = await mockQueueProvider.send(message, { idempotencyKey: 'job-1' });
    const second = await mockQueueProvider.send(message, { idempotencyKey: 'job-1' });

    expect(first.messageId).toBeTruthy();
    expect(second.messageId).toMatch(/^mock-dedupe-/);
  });

  test('readOne exposes the oldest queued message', async () => {
    const message = {
      job_id: 'job-2',
      job_type: 'PROOFIG_SUBMIT_STREAM',
      handshake: 'token',
    };

    await mockQueueProvider.send(message, { idempotencyKey: 'job-2' });

    const entry = await mockQueueProvider.readOne();
    expect(entry?.message).toEqual(message);
    expect(entry?.metadata.deliveryCount).toBe(1);
    expect(entry?.metadata.messageId).toEqual(expect.any(String));

    await mockQueueProvider.ack(entry!.receipt);
    expect(await mockQueueProvider.getDepth()).toBe(0);
  });
});
