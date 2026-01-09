import { describe, test } from 'vitest';
import { expectStatus, expectSuccess } from './helpers';

describe('works.get', () => {
  test('there is no "list all" works endpoint', async () => {
    await expectStatus(405, 'works');
  });
});
