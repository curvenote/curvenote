import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { deleteJob, expectJob, expectStatus, expectSuccess, seedJob } from './helpers';

const id = 'existent-get-id';

describe('jobs.get', () => {
  beforeEach(async () => {
    await seedJob(id);
  });
  afterEach(async () => {
    await deleteJob(id);
  });
  test('GET /jobs/id - non-existent id', async () => {
    const resp = await expectStatus(404, 'jobs/non-existent-id');
    expect(resp.statusText).toEqual('The endpoint was not found.');
  });
  test('GET /jobs/id - existent id', async () => {
    const resp = await expectSuccess(`jobs/${id}`);
    expect(resp.statusText).toEqual('OK');
    const respJson = (await resp.json()) as any;
    expectJob(respJson, { payload: { test: 'payload' } });
  });
});
