import { describe, test, expect } from 'vitest';
import { expectJob, expectStatus, expectSuccess } from './helpers';

describe('jobs.post', () => {
  test('POST /jobs - bad request - non-string job_type', async () => {
    const resp = await expectStatus(400, 'jobs', {
      method: 'POST',
      body: JSON.stringify({ job_type: { not: 'string' }, payload: {} }),
      headers: {
        'content-type': 'application/json',
      },
    });
    expect(resp.statusText).toEqual('job_type must be CHECK');
  });
  test('POST /jobs - bad request - missing payload', async () => {
    const resp = await expectStatus(400, 'jobs', {
      method: 'POST',
      body: JSON.stringify({ job_type: 'CHECK' }),
      headers: {
        'content-type': 'application/json',
      },
    });
    expect(resp.statusText).toEqual('a payload object is required');
  });
  test('POST /jobs - bad request - no body', async () => {
    const resp = await expectStatus(400, 'jobs', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
    });
    expect(resp.statusText).toEqual('invalid request body');
  });
  test('POST /jobs - create work - empty body', async () => {
    const resp = await expectStatus(400, 'jobs', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'content-type': 'application/json',
      },
    });
    expect(resp.statusText).toEqual('a payload object is required');
  });
  test('POST /jobs - create work - with body', async () => {
    const payload = {
      // This status is just in the job payload; it should not affect actual status
      status: 'some status code',
      url: 'https://example.com',
    };
    const resp = await expectSuccess('jobs', {
      method: 'POST',
      body: JSON.stringify({ payload }),
      headers: {
        'content-type': 'application/json',
      },
    });
    expect(resp.statusText).toEqual('OK');
    const respJson = (await resp.json()) as any;
    expectJob(respJson, { payload });
  });
});
