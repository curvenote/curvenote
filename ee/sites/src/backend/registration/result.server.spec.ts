// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';

const activity = vi.hoisted(() => ({ writeRegistrationActivity: vi.fn() }));
vi.mock('./activity.server.js', () => activity);

import { failDeposit } from './result.server.js';

function prisma() {
  const p: any = {
    doiDeposit: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    doiRegistration: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  p.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(p));
  return p;
}

const deposit = {
  id: 'dep-1',
  status: 'PENDING',
  submission_version_id: 'sv-1',
  registration: {
    id: 'reg-1',
    doi: '10.62329/abcd1234',
    status: 'SUBMITTING',
    submission_id: 'sub-1',
    site_id: 'site-a',
  },
};

let p: any;
beforeEach(() => {
  vi.clearAllMocks();
  p = prisma();
});

describe('failDeposit', () => {
  it('fails attempt and registration with the given error', async () => {
    await failDeposit(p, { deposit, error: 'internal_error', userId: 'sa-1' });
    expect(p.doiDeposit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dep-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'FAILED', error: 'internal_error' }),
      }),
    );
    expect(p.doiRegistration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(activity.writeRegistrationActivity).toHaveBeenCalledWith(
      p,
      expect.objectContaining({ type: 'DOI_REGISTRATION_FAILED', userId: 'sa-1' }),
    );
  });

  it('does not write DOI_REGISTRATION_FAILED when the registration is no longer SUBMITTING', async () => {
    p.doiRegistration.updateMany.mockResolvedValue({ count: 0 });
    await failDeposit(p, { deposit, error: 'internal_error', userId: 'sa-1' });
    expect(activity.writeRegistrationActivity).not.toHaveBeenCalled();
  });

  it('is a no-op when the attempt is no longer PENDING (redelivery)', async () => {
    p.doiDeposit.updateMany.mockResolvedValue({ count: 0 });
    await failDeposit(p, { deposit, error: 'internal_error', userId: 'sa-1' });
    expect(p.doiRegistration.updateMany).not.toHaveBeenCalled();
    expect(activity.writeRegistrationActivity).not.toHaveBeenCalled();
  });
});
