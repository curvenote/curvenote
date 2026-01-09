import { describe, test, expect, beforeAll } from 'vitest';
import { users, getToken, expectSuccess, expectStatus, expectWork } from './helpers';

describe('my', () => {
  let token: string | undefined;
  beforeAll(async () => {
    token = await getToken(users.support);
  });
  test('GET /my/works - 401', async () => {
    await expectStatus(401, 'my/works', {
      method: 'GET',
      headers: {
        Authorization: `Bearer qwerty123456`,
      },
    });
  });
  test('GET /my/works - 200', async () => {
    const resp = await expectSuccess('my/works', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const works = (await resp.json()) as any as any;

    works.items.forEach((item: any) => {
      expectWork(item.id, item);
    });

    expect(works.links.self).toContain('v1/my/works');
  });
  test('GET /my/submissions - 401', async () => {
    await expectStatus(401, 'my/submissions', {
      method: 'GET',
      headers: {
        Authorization: `Bearer qwerty123456`,
      },
    });
  });
  test('GET /my/submissions - 200', async () => {
    const resp = await expectSuccess('my/submissions', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const body = (await resp.json()) as any;
    body.items.forEach((item: any) => {
      expect(item).toMatchObject({
        id: expect.any(String),
        date_created: expect.any(String),
        date_last_activity: expect.any(String),
        kind: 'Original',
        kind_id: expect.any(String),
        site_name: expect.stringMatching(/science|private/),
        submitted_by: {
          id: expect.any(String),
          name: expect.any(String),
        },
        title: expect.any(String),
        description: expect.any(String),
        links: expect.objectContaining({
          self: expect.stringMatching('http[s]*://'),
          site: expect.stringMatching('http[s]*://'),
          thumbnail: expect.stringMatching('http[s]*://'),
        }),
        authors: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
          }),
        ]),
        date: expect.any(String),
      });
    });
    expect(body.links.self).toContain('v1/my/submissions');
  });
});
