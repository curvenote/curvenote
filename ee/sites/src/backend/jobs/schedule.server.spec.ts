// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({ ensureJobRow: vi.fn(), dispatchJobWithHandshake: vi.fn() }));
vi.mock('@curvenote/scms-server', () => server);

import { dispatchJob, insertJobRow } from './schedule.server.js';

describe('insertJobRow', () => {
  it('inserts a QUEUED row when not scheduled', async () => {
    const tx = {} as any;
    const result = await insertJobRow(tx, {
      jobType: 'CROSSREF_DEPOSIT',
      payload: { depositId: 'd', siteId: 's', attempt: 1 },
    });
    expect(result.scheduled).toBe(false);
    expect(server.ensureJobRow).toHaveBeenCalledWith(
      expect.objectContaining({
        job_id: result.jobId,
        job_type: 'CROSSREF_DEPOSIT',
        payload: { depositId: 'd', siteId: 's', attempt: 1 },
      }),
      'QUEUED',
      tx,
    );
  });

  it('inserts a SCHEDULED row with scheduled_at when given a future time', async () => {
    const tx = {} as any;
    const at = new Date(Date.now() + 60_000).toISOString();
    const result = await insertJobRow(tx, {
      jobType: 'CROSSREF_DEPOSIT',
      payload: { depositId: 'd', siteId: 's', attempt: 2 },
      scheduledAt: at,
    });
    expect(result.scheduled).toBe(true);
    expect(server.ensureJobRow).toHaveBeenCalledWith(
      expect.objectContaining({ scheduled_at: at }),
      'SCHEDULED',
      tx,
    );
  });

  it('dispatches through the handshake', async () => {
    await dispatchJob('job-1', 'CROSSREF_DEPOSIT');
    expect(server.dispatchJobWithHandshake).toHaveBeenCalledWith({
      id: 'job-1',
      job_type: 'CROSSREF_DEPOSIT',
    });
  });
});
