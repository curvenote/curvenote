// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, test, expect } from 'vitest';
import { checks as checkDefinitions } from '@curvenote/check-definitions';
import { checks } from './index';

describe('checks', () => {
  test('all ids are unique', async () => {
    const ids = checks.map((c) => c.id);
    expect(ids.length).toEqual(new Set(ids).size);
  });
  test('all check definitions are implemented', async () => {
    const checkIds = checks.map(({ id }) => id).sort();
    const defIds = checkDefinitions.map(({ id }) => id).sort();
    expect(checkIds).toEqual(defIds);
  });
});
