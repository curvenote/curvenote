import { describe, test, expect } from 'vitest';
import { expectStatus, expectSuccess } from './helpers';

describe('sites doi API', () => {
  test('invalid doi', async () => {
    const resp = await expectStatus(404, 'sites/science/doi/any/thing');
    expect(resp.statusText).toEqual('Not Found - Invalid DOI');
  });
  test('valid doi, no corrsponding work', async () => {
    const resp = await expectStatus(404, 'sites/science/doi/10.5281/zenodo.6476040');
    expect(resp.statusText).toEqual('Not Found - No work with that DOI exists in database');
  });
  test('valid doi, work available, incorrect site - sites/newscience/published/10.5281/zenodo.5634114', async () => {
    await expectStatus(404, 'sites/newscience/published/10.5281/zenodo.5634114');
  });
  test('find work by doi', async () => {
    await expectSuccess('sites/science/doi/10.5281/zenodo.5634114');
  });
});
