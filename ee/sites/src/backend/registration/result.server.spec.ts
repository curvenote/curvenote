// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';

const activity = vi.hoisted(() => ({ writeRegistrationActivity: vi.fn() }));
vi.mock('./activity.server.js', () => activity);

import { CROSSREF_REJECTED } from './failure.js';
import { applyDepositResult, failDeposit } from './result.server.js';

function prisma() {
  const p: any = {
    doiDeposit: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    doiRegistration: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    submission: { update: vi.fn().mockResolvedValue({ id: 'sub-1' }) },
  };
  p.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(p));
  return p;
}

const deposit = {
  id: 'dep-1',
  status: 'QUEUED',
  submission_version_id: 'sv-1',
  registration: {
    id: 'reg-1',
    doi: '10.62329/abcd1234',
    status: 'SUBMITTING',
    submission_id: 'sub-1',
    site_id: 'site-a',
  },
};

type Outcome = 'success' | 'warning' | 'failure';

function completed(outcome: Outcome, records: { status: Outcome; message: string }[]) {
  return {
    state: 'completed' as const,
    submissionId: '1735620245',
    batchId: 'dep-1',
    outcome,
    records: records.map((record) => ({ ...record, doi: '10.62329/abcd1234' })),
  };
}

const resultXmlPath = 'crossref/results/dep-1.xml';

let p: any;
beforeEach(() => {
  vi.clearAllMocks();
  p = prisma();
});

describe('failDeposit', () => {
  it('fails an open attempt (sending or waiting) and the registration with the given error', async () => {
    await failDeposit(p, { deposit, error: 'internal_error', userId: 'sa-1' });
    expect(p.doiDeposit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dep-1', status: { in: ['PENDING', 'QUEUED'] } },
        data: expect.objectContaining({ status: 'FAILED', error: 'internal_error' }),
      }),
    );
    expect(p.doiRegistration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'reg-1', status: 'SUBMITTING' },
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
    expect(activity.writeRegistrationActivity).toHaveBeenCalledWith(
      p,
      expect.objectContaining({
        type: 'DOI_REGISTRATION_FAILED',
        userId: 'sa-1',
        data: { doi: '10.62329/abcd1234', depositId: 'dep-1', error: 'internal_error' },
      }),
    );
  });

  it('does not write DOI_REGISTRATION_FAILED when the registration is no longer SUBMITTING', async () => {
    p.doiRegistration.updateMany.mockResolvedValue({ count: 0 });
    await failDeposit(p, { deposit, error: 'internal_error', userId: 'sa-1' });
    expect(activity.writeRegistrationActivity).not.toHaveBeenCalled();
  });

  it('is a no-op when the attempt already has a result (redelivery)', async () => {
    p.doiDeposit.updateMany.mockResolvedValue({ count: 0 });
    await failDeposit(p, { deposit, error: 'internal_error', userId: 'sa-1' });
    expect(p.doiRegistration.updateMany).not.toHaveBeenCalled();
    expect(activity.writeRegistrationActivity).not.toHaveBeenCalled();
  });
});

describe('applyDepositResult', () => {
  it('registers on success: attempt SUCCEEDED, registration REGISTERED, Submission.doi set, activity written', async () => {
    await applyDepositResult(p, {
      deposit,
      result: completed('success', [{ status: 'success', message: 'Successfully added' }]),
      resultXmlPath,
      userId: 'sa-1',
    });
    expect(p.doiDeposit.updateMany).toHaveBeenCalledWith({
      where: { id: 'dep-1', status: { in: ['PENDING', 'QUEUED'] } },
      data: expect.objectContaining({
        status: 'SUCCEEDED',
        result_xml_path: resultXmlPath,
        crossref_submission_id: '1735620245',
        completed_at: expect.any(String),
      }),
    });
    expect(p.doiDeposit.updateMany.mock.calls[0][0].data.warning).toBeUndefined();
    expect(p.doiRegistration.updateMany).toHaveBeenCalledWith({
      where: { id: 'reg-1', status: 'SUBMITTING' },
      data: expect.objectContaining({ status: 'REGISTERED', registered_at: expect.any(String) }),
    });
    expect(p.submission.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { doi: '10.62329/abcd1234' },
      select: { id: true },
    });
    expect(activity.writeRegistrationActivity).toHaveBeenCalledWith(p, {
      type: 'DOI_REGISTRATION_COMPLETED',
      siteId: 'site-a',
      submissionId: 'sub-1',
      submissionVersionId: 'sv-1',
      userId: 'sa-1',
      data: { doi: '10.62329/abcd1234', depositId: 'dep-1', warning: undefined },
    });
  });

  it('registers with a warning: the warning records message is kept on the attempt and the activity', async () => {
    await applyDepositResult(p, {
      deposit,
      result: completed('warning', [{ status: 'warning', message: 'Added with conflict' }]),
      resultXmlPath,
      userId: 'sa-1',
    });
    expect(p.doiDeposit.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'SUCCEEDED',
      warning: 'Added with conflict',
    });
    expect(p.submission.update).toHaveBeenCalled();
    expect(activity.writeRegistrationActivity).toHaveBeenCalledWith(
      p,
      expect.objectContaining({
        type: 'DOI_REGISTRATION_COMPLETED',
        userId: 'sa-1',
        data: expect.objectContaining({ warning: 'Added with conflict' }),
      }),
    );
  });

  it('fails on a rejection with Crossref message, and never touches Submission.doi', async () => {
    const xsd = 'Error validating schema crossref5.3.1.xsd : Error: cvc-complex-type.2.4.a';
    await applyDepositResult(p, {
      deposit,
      result: completed('failure', [{ status: 'failure', message: xsd }]),
      resultXmlPath,
      userId: 'sa-1',
    });
    expect(p.doiDeposit.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'FAILED',
      error: xsd,
      result_xml_path: resultXmlPath,
      crossref_submission_id: '1735620245',
    });
    expect(p.doiRegistration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(p.submission.update).not.toHaveBeenCalled();
    expect(activity.writeRegistrationActivity).toHaveBeenCalledWith(
      p,
      expect.objectContaining({
        type: 'DOI_REGISTRATION_FAILED',
        userId: 'sa-1',
        data: expect.objectContaining({ error: xsd }),
      }),
    );
  });

  it('stores the crossref_rejected code when Crossref rejected without a message', async () => {
    await applyDepositResult(p, {
      deposit,
      result: completed('failure', [{ status: 'failure', message: '' }]),
      resultXmlPath,
      userId: 'sa-1',
    });
    expect(p.doiDeposit.updateMany.mock.calls[0][0].data.error).toBe(CROSSREF_REJECTED);
  });

  it('second apply is a no-op: nothing is written when the attempt already has a result', async () => {
    p.doiDeposit.updateMany.mockResolvedValue({ count: 0 });
    await applyDepositResult(p, {
      deposit,
      result: completed('success', [{ status: 'success', message: 'Successfully added' }]),
      resultXmlPath,
      userId: 'sa-1',
    });
    expect(p.doiRegistration.updateMany).not.toHaveBeenCalled();
    expect(p.submission.update).not.toHaveBeenCalled();
    expect(activity.writeRegistrationActivity).not.toHaveBeenCalled();
  });

  it('leaves Submission.doi and the timeline alone when the registration is no longer SUBMITTING', async () => {
    p.doiRegistration.updateMany.mockResolvedValue({ count: 0 });
    await applyDepositResult(p, {
      deposit,
      result: completed('success', [{ status: 'success', message: 'Successfully added' }]),
      resultXmlPath,
      userId: 'sa-1',
    });
    expect(p.submission.update).not.toHaveBeenCalled();
    expect(activity.writeRegistrationActivity).not.toHaveBeenCalled();
  });
});
