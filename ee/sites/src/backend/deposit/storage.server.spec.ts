// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { depositXmlKey } from './storage.server.js';

describe('deposit storage keys', () => {
  it('places deposits under crossref/ in the private bucket', () => {
    expect(depositXmlKey('019a.xml')).toBe('crossref/deposits/019a.xml');
  });
});
