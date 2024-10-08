// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, test, expect } from 'vitest';
import { checks } from './index';

describe('checks', () => {
  test('all ids are unique', async () => {
    const ids = checks.map((c) => c.id);
    expect(ids.length).toEqual(new Set(ids).size);
  });
});
