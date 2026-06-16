/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockVerifyHandshakeToken = vi.fn();
const mockRunHandler = vi.fn();
const mockHandleTransportFailure = vi.fn();
const mockFindUnique = vi.fn();

vi.mock('../../src/app-config.server.js', () => ({
  getConfig: vi.fn(async () => ({
    api: {
      handshakeIssuer: 'issuer',
      handshakeSigningSecret: 'secret',
    },
  })),
}));

vi.mock('../../src/backend/sign.handshake.server.js', () => ({
  verifyHandshakeToken: (...args: unknown[]) => mockVerifyHandshakeToken(...args),
}));

vi.mock('../../src/backend/prisma.server.js', () => ({
  getPrismaClient: vi.fn(async () => ({
    job: {
      findUnique: mockFindUnique,
    },
  })),
}));

vi.mock('../../src/backend/jobs/run/runHandler.server.js', () => ({
  runHandler: (...args: unknown[]) => mockRunHandler(...args),
}));

vi.mock('../../src/backend/jobs/run/handleTransportFailure.server.js', () => ({
  handleTransportFailure: (...args: unknown[]) => mockHandleTransportFailure(...args),
}));

import { processJobMessage } from '../../src/backend/jobs/run/processJobMessage.server.js';

describe('processJobMessage handshake validation', () => {
  beforeEach(() => {
    mockVerifyHandshakeToken.mockReset();
    mockRunHandler.mockReset();
    mockHandleTransportFailure.mockReset();
    mockFindUnique.mockReset();
    mockFindUnique.mockResolvedValue({ id: 'job-1', job_type: 'LOOPBACK' });
  });

  const message = {
    job_id: 'job-1',
    job_type: 'LOOPBACK',
    handshake: 'valid-token',
  };

  const metadata = { deliveryCount: 1, messageId: 'msg-1' };

  test('rejects invalid handshake permanently', async () => {
    mockVerifyHandshakeToken.mockImplementation(() => {
      throw new Error('invalid');
    });

    await processJobMessage(message, metadata);

    expect(mockHandleTransportFailure).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({
        reason: 'invalid_handshake',
      }),
    );
    expect(mockRunHandler).not.toHaveBeenCalled();
  });

  test('rejects jobId mismatch permanently', async () => {
    mockVerifyHandshakeToken.mockReturnValue({ jobId: 'other', aud: 'LOOPBACK' });

    await processJobMessage(message, metadata);

    expect(mockHandleTransportFailure).toHaveBeenCalled();
    expect(mockRunHandler).not.toHaveBeenCalled();
  });

  test('rejects aud !== job_type permanently', async () => {
    mockVerifyHandshakeToken.mockReturnValue({ jobId: 'job-1', aud: 'CHECK' });

    await processJobMessage(message, metadata);

    expect(mockHandleTransportFailure).toHaveBeenCalled();
    expect(mockRunHandler).not.toHaveBeenCalled();
  });

  test('runs handler when handshake is valid', async () => {
    mockVerifyHandshakeToken.mockReturnValue({ jobId: 'job-1', aud: 'LOOPBACK' });

    await processJobMessage(message, metadata);

    expect(mockRunHandler).toHaveBeenCalledWith('job-1', {
      handshakeJob: { jobId: 'job-1', jobType: 'LOOPBACK' },
    });
    expect(mockHandleTransportFailure).not.toHaveBeenCalled();
  });

  test('terminalizes handler throws without retry', async () => {
    mockVerifyHandshakeToken.mockReturnValue({ jobId: 'job-1', aud: 'LOOPBACK' });
    mockRunHandler.mockRejectedValue(new Error('ECONNREFUSED'));

    await processJobMessage(message, metadata);

    expect(mockHandleTransportFailure).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({
        reason: 'domain_failed',
        last_error: 'ECONNREFUSED',
      }),
    );
  });
});
