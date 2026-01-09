import { describe, test, expect } from 'vitest';
import { apiFetch, expectStatus, expectSuccess } from './helpers';

describe('remix server available for tests on localhost:3032', () => {
  test('a server is up', async () => {
    await expectSuccess('/');
  });
  test('journals api available', async () => {
    const resp = await expectSuccess('/');
    expect((await resp.json()) as any).toMatchObject({
      version: 'v1',
      message: '👋 Welcome to the Curvenote Journal API 👋',
    });
  });
});

describe('error handling', () => {
  test('catch all route - 404', async () => {
    await expectStatus(404, '/v1/blah/blah');
  });
});
