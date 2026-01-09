import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { deleteJob, expectJob, expectStatus, expectSuccess, seedJob } from './helpers';
import { JobStatus } from '@prisma/client';
import { createHandshakeToken } from '@curvenote/scms-server';

const id = 'existent-patch-id';
const handshake = createHandshakeToken(id, 'AUDIENCE', 'http://localhost:3031', 'qwerty');
const handshake_bad_job_id = createHandshakeToken(
  'some-other-id',
  'AUDIENCE',
  'http://localhost:3031',
  'qwerty',
);
const expired_handshake = createHandshakeToken(
  'some-other-id',
  'AUDIENCE',
  'http://localhost:3031',
  'qwerty',
  Math.floor(Date.now() / 1000) - 60,
);

describe('jobs.patch', () => {
  beforeEach(async () => {
    await seedJob(id);
  });
  afterEach(async () => {
    await deleteJob(id);
  });
  describe('not authorized', () => {
    test('PATCH /jobs/id - not authorized - no token', async () => {
      const resp = await expectStatus(401, `jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: JobStatus.COMPLETED }),
        headers: {
          'content-type': 'application/json',
        },
      });
      expect(resp.statusText).toContain('Not Authorized');
    });
    test('PATCH /jobs/id - not authorized - bad token', async () => {
      const resp = await expectStatus(401, `jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: JobStatus.COMPLETED }),
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer qwerty`,
        },
      });
      expect(resp.statusText).toContain('Not Authorized');
    });
    test('PATCH /jobs/id - not authorized - expired', async () => {
      const resp = await expectStatus(401, `jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: JobStatus.COMPLETED }),
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${expired_handshake}`,
        },
      });
      expect(resp.statusText).toContain('Not Authorized');
    });
    test('PATCH /jobs/id - not authorized - bad job id', async () => {
      const resp = await expectStatus(401, `jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: JobStatus.COMPLETED }),
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${handshake_bad_job_id}`,
        },
      });
      expect(resp.statusText).toContain('Not Authorized');
    });
  });
  describe('with authorization', () => {
    test('PATCH /jobs/id - non-existent id', async () => {
      const resp = await expectStatus(404, 'jobs/non-existent-id', {
        method: 'PATCH',
        body: JSON.stringify({ status: JobStatus.COMPLETED, results: { some: 'thing' } }),
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${handshake}`,
        },
      });
      expect(resp.statusText).toEqual('The endpoint was not found.');
    });
    test('PATCH /jobs/id - bad request - non-string status', async () => {
      const resp = await expectStatus(400, `jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: { not: 'string' } }),
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${handshake}`,
        },
      });
      expect(resp.statusText).toEqual('status must be QUEUED, RUNNING, COMPLETED, FAILED');
    });
    test('PATCH /jobs/id - bad request - non-string message', async () => {
      const resp = await expectStatus(400, `jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: JobStatus.COMPLETED,
          handshake,
          message: { not: 'string' },
        }),
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${handshake}`,
        },
      });
      expect(resp.statusText).toEqual('message must be a string');
    });

    test('PATCH /jobs/id - bad request - no body', async () => {
      const resp = await expectStatus(400, `jobs/${id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${handshake}`,
        },
      });
      expect(resp.statusText).toEqual('invalid request body');
    });
    test('PATCH /jobs/id - fail job and prevent modification', async () => {
      const resp = await expectSuccess(`jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: JobStatus.FAILED }),
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${handshake}`,
        },
      });
      expect(resp.statusText).toEqual('OK');
      const respJson = (await resp.json()) as any;
      expectJob(respJson, { status: JobStatus.FAILED, payload: { test: 'payload' } });
      const failResp = await expectStatus(400, `jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: JobStatus.RUNNING }),
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${handshake}`,
        },
      });
      expect(failResp.statusText).toEqual('Cannot update FAILED job');
    });
    test('PATCH /jobs/id - complete job and prevent modification', async () => {
      const resp = await expectSuccess(`jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: JobStatus.COMPLETED,
          results: { test: 'result' },
        }),
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${handshake}`,
        },
      });
      expect(resp.statusText).toEqual('OK');
      const respJson = (await resp.json()) as any;
      expectJob(respJson, {
        status: JobStatus.COMPLETED,
        payload: { test: 'payload' },
        results: { test: 'result' },
      });
      const failResp = await expectStatus(400, `jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: JobStatus.RUNNING }),
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${handshake}`,
        },
      });
      expect(failResp.statusText).toEqual('Cannot update COMPLETED job');
    });
    test('PATCH /jobs/id - complete job and prevent modification', async () => {
      const respStart = await expectSuccess(`jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: JobStatus.RUNNING,
          message: 'start',
        }),
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${handshake}`,
        },
      });
      expect(respStart.statusText).toEqual('OK');
      const respStartJson = await respStart.json();
      expectJob(respStartJson, {
        status: JobStatus.RUNNING,
        payload: { test: 'payload' },
        messages: ['start'],
      });
      const respCont = await expectSuccess(`jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: JobStatus.RUNNING,
          message: 'continue',
          results: { test: 'temp results' },
        }),
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${handshake}`,
        },
      });
      expect(respCont.statusText).toEqual('OK');
      const respContJson = await respCont.json();
      expectJob(respContJson, {
        status: JobStatus.RUNNING,
        payload: { test: 'payload' },
        messages: ['start', 'continue'],
        results: { test: 'temp results' },
      });
    });
  });
});
