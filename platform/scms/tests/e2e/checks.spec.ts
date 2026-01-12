// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, test, expect } from 'vitest';
import { expectStatus, expectSuccess } from './helpers';

describe('checks api returns', () => {
  test('GET /checks - returns items', async () => {
    const resp = await expectSuccess('checks');
    const data = (await resp.json()) as any as any;

    expect(data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          title: expect.any(String),
          purpose: expect.any(String),
          tags: expect.arrayContaining([expect.any(String)]),
          links: expect.objectContaining({
            self: expect.stringContaining('http://'),
          }),
        }),
      ]),
    );
  });
  test('GET /checks/id - known id returns', async () => {
    const resp = await expectSuccess('checks/block-metadata-loads');
    const data = (await resp.json()) as any;

    expect(data).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: expect.any(String),
        purpose: expect.any(String),
        tags: expect.arrayContaining([expect.any(String)]),
        links: expect.objectContaining({
          self: expect.stringContaining('http://'),
        }),
      }),
    );
  });
  test('GET /checks/id - unknown id 404', async () => {
    await expectStatus(404, 'checks/unknown');
  });
});
