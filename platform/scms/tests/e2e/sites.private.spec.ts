import { describe, test, expect, beforeAll } from 'vitest';
import { expectStatus, expectSuccess, getPrivateSiteToken } from './helpers';
import privateSite from '../../prisma/data.test/private.json';

async function expectNotAuthorized(url: string) {
  await expectStatus(401, url);
  await expectStatus(401, url, {
    headers: {
      Authorization: 'Bearer not-a-real-token',
    },
  });
}

describe('sites.private', () => {
  describe('anonymous access', () => {
    test('get site by name', async () => expectSuccess('sites/private'));
  });
  describe('not authorized without token', () => {
    test('get site works', async () => expectNotAuthorized('sites/private/works'));
    test('get site work published version', async () =>
      expectNotAuthorized('sites/private/works/PRV00001/published'));
    test('get site collections', async () => expectNotAuthorized('sites/private/collections'));
    test('get site collection by id', async () =>
      expectNotAuthorized('sites/private/collections/articles'));
    test('get site kinds', async () => expectSuccess('sites/private/kinds'));
  });
  describe('not allowed - 405', () => {
    test('GET sites/private/submissions', async () =>
      expectStatus(405, 'sites/private/submissions'));
    test('GET sites/private/submissions/any-id', async () =>
      expectStatus(405, 'sites/private/submissions/any-id'));
  });
  describe('with authorization', () => {
    let headers: Record<string, string> = {};
    beforeAll(async () => {
      headers = {
        Authorization: `Bearer ${getPrivateSiteToken('private', 'qwerty')}`,
      };
    });
    test('get site by name', async () => {
      const resp = await expectSuccess(`sites/private`, { headers });
      const site = (await resp.json()) as any;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { url, kinds, submission_cdn, ...data } = privateSite.site as any;

      expect(site).toMatchObject({
        ...data,
        id: expect.any(String),
        links: {
          self: expect.any(String),
          html: expect.any(String),
          works: expect.any(String),
          collections: expect.any(String),
        },
      });
    });
    test(`sites/private/works`, async () => {
      const resp = await expectSuccess(`sites/private/works`, { headers });
      const works = (await resp.json()) as any;

      expect(works.items).toHaveLength(1);

      works.items.forEach((item: any) => {
        expect(item.cdn_query).toEqual(expect.any(String));
        expect(item.links.config).toEqual(`${item.cdn}${item.key}/config.json?${item.cdn_query}`);
        expect(item).toMatchObject({
          id: expect.any(String),
          version_id: expect.any(String),
          title: expect.any(String),
          date: expect.any(String),
          authors: expect.arrayContaining([{ name: expect.any(String) }]),
          canonical: expect.any(Boolean),
          cdn: expect.stringContaining('https://'),
          key: expect.any(String),
          cdn_query: expect.any(String),
          date_created: expect.any(String),
          description: expect.any(String),
          kind: expect.stringMatching(/Original/),
          links: {
            self: expect.stringMatching(
              `http://.*/v1/sites/private/works/${item.id}/versions/${item.version_id}`,
            ),
            site: expect.stringMatching(`http://.*/v1/sites/private`),
            latest: expect.stringMatching(
              `http://.*/v1/sites/private/works/${item.id}/versions/${item.version_id}`,
            ),
            social: expect.stringMatching(`http://.*/v1/`), // TODO move to scope scope
            thumbnail: expect.stringMatching(`http://.*/v1/`), // TODO move to scope scope
            config: expect.any(String), // asserted above
          },
        });
      });
    });
    test('sites/private/collections', async () => {
      const resp = await expectSuccess(`sites/private/collections`, { headers });
      const works = (await resp.json()) as any;

      expect(works.items).toEqual([
        {
          id: 'articles',
          title: 'Articles',
          links: {
            self: expect.stringMatching(/http:\/\/.*/),
          },
        },
      ]);

      const worksWithoutDate = works.items.map((work: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { date, ...rest } = work;
        return rest;
      });

      expect(worksWithoutDate).toMatchSnapshot();
    });
  });
});
