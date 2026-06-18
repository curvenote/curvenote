/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach, vi } from 'vitest';

type RawArg = unknown;

function sqlText(arg: RawArg): string {
  const candidate = arg as { sql?: string; strings?: string[] };
  if (typeof candidate?.sql === 'string') return candidate.sql;
  if (Array.isArray(candidate?.strings)) return candidate.strings.join(' ');
  return String(arg);
}

const executeRaw = vi.fn();
const queryRaw = vi.fn();
const mockHandleTransportFailure = vi.fn();

const tx = {
  $executeRaw: executeRaw,
  $queryRaw: queryRaw,
};

const prisma = {
  // Run the callback with a transaction client, mirroring prisma.$transaction.
  $transaction: vi.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)),
  $executeRaw: executeRaw,
  $queryRaw: queryRaw,
};

vi.mock('../../src/backend/prisma.server.js', () => ({
  getPrismaClient: vi.fn(async () => prisma),
}));

vi.mock('../../src/backend/jobs/run/handleTransportFailure.server.js', () => ({
  handleTransportFailure: (...args: unknown[]) => mockHandleTransportFailure(...args),
}));

const { readOneJobMessage, sendJobMessage } = await import(
  '../../src/backend/jobs/enqueue/pgmq/jobQueue.server.js'
);

const message = { job_id: 'job-1', job_type: 'LOOPBACK', handshake: 'token' };

describe('sendJobMessage', () => {
  beforeEach(() => {
    executeRaw.mockReset();
    queryRaw.mockReset();
    mockHandleTransportFailure.mockReset();
    prisma.$transaction.mockClear();
  });

  test('takes a per-job advisory lock and only enqueues when no message exists', async () => {
    // Conditional pgmq.send returns a row (a new message was inserted).
    queryRaw.mockResolvedValueOnce([{ send: 42n }]);

    const result = await sendJobMessage(message, { idempotencyKey: 'job-1' });

    expect(result.messageId).toBe('42');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    // Advisory lock keyed on the idempotencyKey serializes concurrent sends.
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(sqlText(executeRaw.mock.calls[0]![0])).toContain('pg_advisory_xact_lock');

    // The enqueue is guarded by WHERE NOT EXISTS so it honors idempotency.
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sendSql = sqlText(queryRaw.mock.calls[0]![0]);
    expect(sendSql).toContain('pgmq.send');
    expect(sendSql).toContain('NOT EXISTS');
  });

  test('skips the duplicate enqueue and returns the existing message id', async () => {
    // Conditional send returns no rows (a message for this job already exists),
    // then the existing-message lookup returns its msg_id.
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ msg_id: 7n }]);

    const result = await sendJobMessage(message, { idempotencyKey: 'job-1' });

    expect(result.messageId).toBe('7');
    expect(queryRaw).toHaveBeenCalledTimes(2);
    // No second pgmq.send was issued — only the conditional send + lookup.
    const sendCalls = queryRaw.mock.calls.filter((call) => sqlText(call[0]).includes('pgmq.send'));
    expect(sendCalls).toHaveLength(1);
  });

  test('falls back to the idempotencyKey when the existing message id is unknown', async () => {
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await sendJobMessage(message, { idempotencyKey: 'job-1' });

    expect(result.messageId).toBe('job-1');
  });
});

describe('readOneJobMessage', () => {
  beforeEach(() => {
    executeRaw.mockReset();
    queryRaw.mockReset();
    mockHandleTransportFailure.mockReset();
    prisma.$transaction.mockClear();
  });

  test('dead-letters exhausted messages and enqueues default failure cleanup', async () => {
    queryRaw.mockResolvedValueOnce([
      {
        msg_id: 99n,
        read_ct: 4,
        message,
      },
    ]);
    queryRaw.mockResolvedValueOnce([]);

    const result = await readOneJobMessage();

    expect(result).toBeNull();
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(sqlText(executeRaw.mock.calls[0]![0])).toContain('pgmq.archive');
    expect(mockHandleTransportFailure).toHaveBeenCalledWith('job-1', {
      reason: 'transport_exhausted',
      source: 'dead_letter',
      last_error: 'Job dispatch failed after 3 delivery attempts',
    });
  });
});
