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

const tx = {
  $executeRaw: executeRaw,
  $queryRaw: queryRaw,
};

const prisma = {
  // Run the callback with a transaction client, mirroring prisma.$transaction.
  $transaction: vi.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)),
};

vi.mock('../../src/backend/prisma.server.js', () => ({
  getPrismaClient: vi.fn(async () => prisma),
}));

const { supabaseQueueProvider } =
  await import('../../src/backend/jobs/enqueue/queueProviders/supabase.server.js');

const message = { job_id: 'job-1', job_type: 'LOOPBACK', handshake: 'token' };

describe('supabaseQueueProvider.send', () => {
  beforeEach(() => {
    executeRaw.mockReset();
    queryRaw.mockReset();
    prisma.$transaction.mockClear();
  });

  test('takes a per-job advisory lock and only enqueues when no message exists', async () => {
    // Conditional pgmq.send returns a row (a new message was inserted).
    queryRaw.mockResolvedValueOnce([{ send: 42n }]);

    const result = await supabaseQueueProvider.send(message, { idempotencyKey: 'job-1' });

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

    const result = await supabaseQueueProvider.send(message, { idempotencyKey: 'job-1' });

    expect(result.messageId).toBe('7');
    expect(queryRaw).toHaveBeenCalledTimes(2);
    // No second pgmq.send was issued — only the conditional send + lookup.
    const sendCalls = queryRaw.mock.calls.filter((call) => sqlText(call[0]).includes('pgmq.send'));
    expect(sendCalls).toHaveLength(1);
  });

  test('falls back to the idempotencyKey when the existing message id is unknown', async () => {
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await supabaseQueueProvider.send(message, { idempotencyKey: 'job-1' });

    expect(result.messageId).toBe('job-1');
  });
});
