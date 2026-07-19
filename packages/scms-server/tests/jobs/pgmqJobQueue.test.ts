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

const { sendJobMessage, readOneJobMessage } = await import(
  '../../src/backend/jobs/enqueue/pgmq/jobQueue.server.js'
);
const { drainOneJob } = await import('../../src/backend/jobs/enqueue/drainOneJob.server.js');
const { resolveQueueDrainUrl, resolveStoredQueueDrainUrl } = await import(
  '../../src/backend/jobs/enqueue/notifyQueueConsumer.server.js'
);

const message = { job_id: 'job-1', job_type: 'LOOPBACK', handshake: 'token' };

describe('queue drain url resolution', () => {
  test('appends the drain route to an origin base', () => {
    expect(resolveQueueDrainUrl('https://scms.curvenote.dev')).toBe(
      'https://scms.curvenote.dev/v1/jobs/push-to-drain',
    );
  });

  test('does not duplicate v1 when api.url is already a v1 base', () => {
    expect(resolveQueueDrainUrl('https://scms.curvenote.dev/v1')).toBe(
      'https://scms.curvenote.dev/v1/jobs/push-to-drain',
    );
  });

  test('uses tasksCallbackUrl with the same v1 normalization', () => {
    expect(
      resolveStoredQueueDrainUrl({
        url: 'https://scms.curvenote.dev/v1',
        tasksCallbackUrl: 'http://host.docker.internal:3031/v1/',
      }),
    ).toBe('http://host.docker.internal:3031/v1/jobs/push-to-drain');
  });
});

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

describe('drainOneJob', () => {
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

    const consume = vi.fn();
    const result = await drainOneJob(consume);

    expect(result).toBe(false);
    expect(consume).not.toHaveBeenCalled();
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(sqlText(executeRaw.mock.calls[0]![0])).toContain('pgmq.archive');
    expect(mockHandleTransportFailure).toHaveBeenCalledWith('job-1', {
      reason: 'transport_exhausted',
      source: 'dead_letter',
      last_error: 'Job dispatch failed after 3 delivery attempts',
    });
  });
});

describe('readOneJobMessage poison-message cap', () => {
  beforeEach(() => {
    executeRaw.mockReset();
    queryRaw.mockReset();
  });

  test('stops after MAX_POISON_MESSAGES_PER_READ and defers the remainder', async () => {
    const MAX_POISON_MESSAGES_PER_READ = 25;
    // Every read returns another over-delivered (poisoned) message — never empty,
    // never deliverable — so without a cap this would loop forever.
    for (let i = 0; i < MAX_POISON_MESSAGES_PER_READ; i += 1) {
      queryRaw.mockResolvedValueOnce([{ msg_id: BigInt(i), read_ct: 4, message }]);
    }

    const onDeadLetter = vi.fn();
    const result = await readOneJobMessage(onDeadLetter);

    expect(result).toBeNull();
    expect(queryRaw).toHaveBeenCalledTimes(MAX_POISON_MESSAGES_PER_READ);
    expect(executeRaw).toHaveBeenCalledTimes(MAX_POISON_MESSAGES_PER_READ);
    expect(onDeadLetter).toHaveBeenCalledTimes(MAX_POISON_MESSAGES_PER_READ);
  });

  test('returns a deliverable message found before the cap without hitting it', async () => {
    queryRaw
      .mockResolvedValueOnce([{ msg_id: 1n, read_ct: 4, message }])
      .mockResolvedValueOnce([{ msg_id: 2n, read_ct: 1, message }]);

    const result = await readOneJobMessage(vi.fn());

    expect(result?.msgId).toBe(2n);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });
});
