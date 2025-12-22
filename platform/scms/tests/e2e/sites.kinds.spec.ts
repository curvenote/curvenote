import { describe, test, expect } from 'vitest';
import { expectSuccess } from './helpers';

describe('sites/id/kinds', () => {
  test(`sites/science/kinds`, async () => {
    const resp = await expectSuccess(`sites/science/kinds`);
    const kinds = (await resp.json()) as any;

    expect(kinds.items).toHaveLength(1);
    expect(kinds.items[0]).toMatchObject({
      id: expect.any(String),
      date_created: expect.any(String),
      name: 'Original',
      checks: expect.arrayContaining([]),
    });
  });
});
