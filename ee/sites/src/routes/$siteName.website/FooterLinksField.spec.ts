// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { footerLinksError, MAX_FOOTER_LINK_COLUMNS, summarizeIssues } from './FooterLinksField.js';

const link = (title: string, url: string) => ({ title, url });

describe('footerLinksError', () => {
  it('is undefined for well formed columns', () => {
    expect(footerLinksError([[link('Home', '/')], [link('Docs', '/docs')]])).toBeUndefined();
  });

  it('is undefined for no columns', () => {
    expect(footerLinksError([])).toBeUndefined();
  });

  it('flags an empty column by number', () => {
    expect(footerLinksError([[link('Home', '/')], []])).toBe('Column 2 has no links.');
  });

  it('says which part of a link is missing', () => {
    expect(footerLinksError([[link('', '/a')]])).toBe('Link 1 in column 1 needs a title.');
    expect(footerLinksError([[link('A', '')]])).toBe('Link 1 in column 1 needs a link.');
    expect(footerLinksError([[link('', '')]])).toBe('Link 1 in column 1 needs a title and a link.');
  });

  it('treats whitespace as blank', () => {
    expect(footerLinksError([[link('  ', '/a')]])).toBe('Link 1 in column 1 needs a title.');
  });

  it('locates the problem link across columns', () => {
    expect(footerLinksError([[link('A', '/a')], [link('B', '/b'), link('', '/c')]])).toBe(
      'Link 2 in column 2 needs a title.',
    );
  });

  it(`flags more than ${MAX_FOOTER_LINK_COLUMNS} columns`, () => {
    const columns = Array.from({ length: MAX_FOOTER_LINK_COLUMNS + 1 }, (_, i) => [
      link(`L${i}`, `/${i}`),
    ]);
    expect(footerLinksError(columns)).toBe(
      `There can be at most ${MAX_FOOTER_LINK_COLUMNS} columns.`,
    );
  });

  it('joins several problems and caps the list', () => {
    expect(footerLinksError([[link('', '/a')], []])).toBe(
      'Link 1 in column 1 needs a title; Column 2 has no links.',
    );
    expect(
      footerLinksError([[link('', ''), link('', ''), link('', ''), link('', ''), link('', '')]]),
    ).toMatch(/; Link 3 in column 1 needs a title and a link, and 2 more\.$/);
  });
});

describe('summarizeIssues', () => {
  it('is undefined with nothing to say', () => {
    expect(summarizeIssues([])).toBeUndefined();
  });

  it('ends a short list with a full stop', () => {
    expect(summarizeIssues(['One', 'Two'])).toBe('One; Two.');
  });

  it('shows the first three and counts the rest', () => {
    expect(summarizeIssues(['One', 'Two', 'Three', 'Four', 'Five'])).toBe(
      'One; Two; Three, and 2 more.',
    );
  });
});
