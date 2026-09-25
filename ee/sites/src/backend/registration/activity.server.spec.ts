// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi } from 'vitest';
import type { DoiTx } from '../doi/types.js';
import { writeRegistrationActivity } from './activity.server.js';

vi.mock('@curvenote/scms-db', () => ({
  ActivityType: {
    DOI_REGISTRATION_STARTED: 'DOI_REGISTRATION_STARTED',
    DOI_REGISTRATION_COMPLETED: 'DOI_REGISTRATION_COMPLETED',
    DOI_REGISTRATION_FAILED: 'DOI_REGISTRATION_FAILED',
  },
}));

describe('writeRegistrationActivity', () => {
  it('writes one activity with the right type, connections and data', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'act-1' });
    const tx = { activity: { create } };

    await writeRegistrationActivity(tx as unknown as DoiTx, {
      type: 'DOI_REGISTRATION_STARTED',
      siteId: 'site-a',
      submissionId: 'sub-1',
      submissionVersionId: 'subv-1',
      userId: 'user-1',
      data: { doi: '10.62329/acdf2345', depositId: 'dep-1' },
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({
      activity_type: 'DOI_REGISTRATION_STARTED',
      activity_by: { connect: { id: 'user-1' } },
      site: { connect: { id: 'site-a' } },
      submission: { connect: { id: 'sub-1' } },
      submission_version: { connect: { id: 'subv-1' } },
      data: { doi: '10.62329/acdf2345', depositId: 'dep-1' },
    });
  });
});
