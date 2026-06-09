import { describe, test, expect } from 'vitest';
import { expectStatus, expectSuccess } from './helpers';

describe('catalog submissions API', () => {
  test('lists published submissions without auth', async () => {
    const resp = await expectSuccess('submissions');
    const body = (await resp.json()) as {
      total: number;
      items: unknown[];
      links: { self: string };
    };

    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.links.self).toContain('/v1/submissions');
  });

  test('catalog items include site summary and resolve link', async () => {
    const resp = await expectSuccess('submissions?site=science&limit=10');
    const body = (await resp.json()) as {
      items: Array<{
        site: { name: string; title: string; links: { self: string } };
        links: { resolve?: string };
      }>;
    };

    expect(body.items.length).toBeGreaterThanOrEqual(1);
    const item = body.items[0];
    expect(item.site).toMatchObject({
      name: 'science',
      title: expect.any(String),
      links: { self: expect.stringMatching(/\/v1\/sites\/science/) },
    });
    expect(item.links.resolve).toContain('/doi/');
    expect(item.links.resolve).toContain('site=science');
  });

  test('rejects private site in site filter', async () => {
    const resp = await expectStatus(400, 'submissions?site=private');
    expect(resp.statusText).toContain('Unknown or inaccessible site');
  });

  test('filters by public site', async () => {
    const resp = await expectSuccess('submissions?site=science');
    const body = (await resp.json()) as { items: Array<{ site: { name: string } }> };

    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.items.every((item) => item.site.name === 'science')).toBe(true);
  });
});

describe('global doi API', () => {
  test('invalid doi', async () => {
    const resp = await expectStatus(404, 'doi/any/thing');
    expect(resp.statusText).toEqual('Not Found - Invalid DOI');
  });

  test('valid doi, no corresponding work', async () => {
    const resp = await expectStatus(404, 'doi/10.5281/zenodo.6476040');
    expect(resp.statusText).toEqual('Not Found - No work with that DOI exists in database');
  });

  test('resolve published doi without site scope', async () => {
    await expectSuccess('doi/10.5281/zenodo.5634114');
  });

  test('resolve with site query param', async () => {
    const resp = await expectSuccess('doi/10.5281/zenodo.5634114?site=science');
    const body = (await resp.json()) as { site: { name: string }; links: { self: string } };

    expect(body.site.name).toBe('science');
    expect(body.links.self).toContain('site=science');
  });

  test('site scope returns 404 when doi is not on that site', async () => {
    await expectStatus(404, 'doi/10.5281/zenodo.5634114?site=newscience');
  });
});
