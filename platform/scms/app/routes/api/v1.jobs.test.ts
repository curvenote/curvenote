/* eslint-disable import/no-extraneous-dependencies */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnownJobTypes } from '@curvenote/scms-core';

const enqueueAndDispatchJob = vi.fn(async () => ({
  job_id: 'job-1',
  job_type: KnownJobTypes.CHECK,
  status: 'DISPATCHED' as const,
}));

vi.mock('@curvenote/scms-server', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    withContext: vi.fn(async () => ({ user: { id: 'user-1' } })),
    ensureJsonBodyFromMethod: vi.fn(async () => requestBody),
    enqueueAndDispatchJob,
    registerExtensionJobs: vi.fn(() => []),
  };
});

vi.mock('../../extensions/server', () => ({ extensions: [] }));

let requestBody: Record<string, unknown> = {
  job_type: KnownJobTypes.CHECK,
  payload: { work_version_id: 'wv-1' },
};

const { action } = await import('./v1.jobs');

function createRequest(): Request {
  return new Request('http://localhost/v1/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
}

describe('POST /v1/jobs action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestBody = {
      job_type: KnownJobTypes.CHECK,
      payload: { work_version_id: 'wv-1' },
    };
  });

  it('returns 400 when follow_on is present', async () => {
    requestBody = {
      ...requestBody,
      follow_on: {
        on_success: {
          job_type: KnownJobTypes.CHECK,
          payload: { work_version_id: 'wv-1' },
        },
      },
    };

    await expect(action({ request: createRequest() } as never)).rejects.toMatchObject({
      status: 400,
    });
    expect(enqueueAndDispatchJob).not.toHaveBeenCalled();
  });

  it('returns 400 for other unknown top-level fields', async () => {
    requestBody = {
      ...requestBody,
      dependents: [
        {
          job_id: 'dep-1',
          job_type: KnownJobTypes.CHECK,
          payload: {},
          trigger_on: 'success',
        },
      ],
    };

    await expect(action({ request: createRequest() } as never)).rejects.toMatchObject({
      status: 400,
    });
    expect(enqueueAndDispatchJob).not.toHaveBeenCalled();
  });

  it('creates a job when the body matches the schema', async () => {
    const response = await action({ request: createRequest() } as never);

    expect(response.status).toBe(201);
    expect(enqueueAndDispatchJob).toHaveBeenCalledOnce();
  });
});
