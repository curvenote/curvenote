/* eslint-disable @typescript-eslint/no-non-null-assertion */
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect } from 'vitest';
import { getPageValues, isOffsetPaginationRequested, makePaginationLinks } from './pagination.js';

const baseLinks = {
  self: 'https://api.example.com/v1/sites/demo/works',
  site: 'https://api.example.com/v1/sites/demo',
};

describe('isOffsetPaginationRequested', () => {
  it('is true when limit and page are set, including page 0', () => {
    expect(isOffsetPaginationRequested({ limit: 30, page: 0 })).toBe(true);
    expect(isOffsetPaginationRequested({ limit: 10, page: 2 })).toBe(true);
  });

  it('is false when only limit or only page is set', () => {
    expect(isOffsetPaginationRequested({ limit: 30 })).toBe(false);
    expect(isOffsetPaginationRequested({ page: 0 })).toBe(false);
    expect(isOffsetPaginationRequested({})).toBe(false);
  });
});

describe('getPageValues', () => {
  it('returns no prev on first page (page 0) and next when more items exist', () => {
    expect(getPageValues(100, { limit: 30, page: 0 })).toEqual({ prev: undefined, next: 1 });
  });

  it('returns no prev and no next on first page when total fits in one page', () => {
    expect(getPageValues(25, { limit: 30, page: 0 })).toEqual({ prev: undefined, next: undefined });
  });

  it('returns prev 0 and next 2 on middle page', () => {
    expect(getPageValues(100, { limit: 30, page: 1 })).toEqual({ prev: 0, next: 2 });
  });

  it('returns prev but no next on last page', () => {
    expect(getPageValues(85, { limit: 30, page: 2 })).toEqual({ prev: 1, next: undefined });
  });

  it('returns no links when limit is omitted', () => {
    expect(getPageValues(100, { page: 0 })).toEqual({ prev: undefined, next: undefined });
  });
});

describe('makePaginationLinks', () => {
  it('leaves links unchanged when limit and page are omitted', () => {
    const links = makePaginationLinks(baseLinks, 100, {});
    expect(links).toEqual(baseLinks);
    expect(links).not.toHaveProperty('next');
    expect(links).not.toHaveProperty('prev');
  });

  it('includes page=0 on self and next link for first page of a larger catalog', () => {
    const links = makePaginationLinks(baseLinks, 100, { limit: 30, page: 0 });
    const self = new URL(links.self);
    expect(self.searchParams.get('page')).toBe('0');
    expect(self.searchParams.get('limit')).toBe('30');
    expect(links.prev).toBeUndefined();

    expect(links.next).toBeDefined();
    const next = new URL(links.next!);
    expect(next.searchParams.get('page')).toBe('1');
    expect(next.searchParams.get('limit')).toBe('30');
  });

  it('includes prev and next on a middle page', () => {
    const links = makePaginationLinks(baseLinks, 100, { limit: 30, page: 1 });
    const prev = new URL(links.prev!);
    const next = new URL(links.next!);
    expect(prev.searchParams.get('page')).toBe('0');
    expect(next.searchParams.get('page')).toBe('2');
  });

  it('omits next on the last page', () => {
    const links = makePaginationLinks(baseLinks, 85, { limit: 30, page: 2 });
    expect(links.next).toBeUndefined();
    expect(new URL(links.prev!).searchParams.get('page')).toBe('1');
  });
});
