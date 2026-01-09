import { describe, test, expect } from 'vitest';
import { expectStatus, expectSuccess } from './helpers';
import science from '../../prisma/data.test/science.json';
import newscience from '../../prisma/data.test/newscience.json';

describe('sites.public', () => {
  describe('is public - no authorization needed', () => {
    test('get sites/science', async () => expectSuccess('sites/science'));
    test('get sites/science/kinds', async () => expectSuccess('sites/science/kinds'));
    test('get sites/science/works', async () => expectSuccess('sites/science/works'));
    test('get sites/science/works/CRV0001/published', async () =>
      expectSuccess('sites/science/works/CRV0001/published'));
    test('get sites/science/collections', async () => expectSuccess('sites/science/collections'));
    test('get sites/science/collections/articles', async () =>
      expectSuccess('sites/science/collections/articles'));
  });
  describe('not allowed - 405', () => {
    test('GET sites/science/submissions', async () =>
      expectStatus(405, 'sites/science/submissions'));
    test('GET sites/science/submissions/any-id', async () =>
      expectStatus(405, 'sites/science/submissions/any-id'));
    test('GET sites/science/sign', async () => expectStatus(405, 'sites/science/sign'));
  });
  describe('public site responses', () => {
    test.each(['science', 'newscience'])('get site data by name - %s', async (siteName) => {
      const resp = await expectSuccess(`sites/${siteName}`);
      const site = (await resp.json()) as any;

      let data = {};
      let html: string | undefined;
      switch (siteName) {
        case 'science': {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { url, kinds, submission_cdn, ...rest } = science.site as any;
          data = rest;
          html = url;
          break;
        }
        case 'newscience': {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { url, kinds, submission_cdn, ...rest } = newscience.site as any;
          data = rest;
          html = url;
          break;
        }
      }
      expect(site).toMatchObject({
        ...data,
        id: expect.any(String),
        links: {
          self: expect.any(String),
          html: html ?? expect.any(String),
          works: expect.any(String),
          collections: expect.any(String),
        },
      });
    });
    test(`sites/science/works`, async () => {
      const resp = await expectSuccess(`sites/science/works`);
      const works = (await resp.json()) as any;

      expect(works.items).toHaveLength(2);

      works.items.forEach((item: any) => {
        expect(item).toMatchObject({
          id: expect.any(String),
          version_id: expect.any(String),
          title: expect.any(String),
          date: expect.any(String),
          authors: expect.arrayContaining([{ name: expect.any(String) }]),
          canonical: expect.any(Boolean),
          cdn: expect.stringContaining('https://'),
          key: expect.any(String),
          date_created: expect.any(String),
          description: expect.any(String),
          kind: expect.stringMatching(/Original/),
          links: {
            self: expect.stringMatching(
              `http://.*/v1/sites/science/works/${item.id}/versions/${item.version_id}`,
            ),
            site: expect.stringMatching(`http://.*/v1/sites/science`),
            latest: expect.stringMatching(
              `http://.*/v1/sites/science/works/${item.id}/versions/${item.version_id}`,
            ),
            social: expect.stringMatching(`http://.*/v1/`),
            thumbnail: expect.stringMatching(`http://.*/v1/`),
            config: expect.stringMatching(`${item.cdn}${item.key}/config.json`),
          },
        });
      });
    });
    test(`sites/newscience/works`, async () => {
      const resp = await expectSuccess(`sites/newscience/works`);
      const works = (await resp.json()) as any;
      expect(works.items).toHaveLength(0);
    });
    test(`sites/science/kinds`, async () => {
      const resp = await expectSuccess(`sites/science/kinds`);
      const kinds = (await resp.json()) as any;
      expect(kinds.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            date_created: expect.any(String),
          }),
        ]),
      );
      expect(kinds.links).toEqual({
        self: expect.stringMatching(/http[s]*:\/\/.*/),
        site: expect.stringMatching(/http[s]*:\/\/.*/),
        submission_cdn: expect.stringMatching(/http[s]*:\/\/.*/),
      });
    });
    test('sites/science/collections', async () => {
      const resp = await expectSuccess(`sites/science/collections`);
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
  describe('thumbs and social', () => {
    test('HEAD work thumbnails by id', async () => {
      await expectSuccess(`sites/science/works/EC220001/thumbnail`);
    });
    test('HEAD work social by id', async () => {
      await expectSuccess(`sites/science/works/EC220001/social`);
    });
    test('HEAD work version thumbnail', async () => {
      await expectSuccess(
        `sites/science/works/CRV0001/versions/cdd87129-6ea8-4ed5-8c9f-14aa94a60a01/thumbnail`,
        {
          method: 'HEAD',
        },
      );
    });
    test('HEAD work version social', async () => {
      await expectSuccess(
        `sites/science/works/CRV0001/versions/cdd87129-6ea8-4ed5-8c9f-14aa94a60a01/social`,
      );
    });
  });
});
