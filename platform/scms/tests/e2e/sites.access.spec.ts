import { describe, test } from 'vitest';
import { expectStatus, expectSuccess, getToken, users } from './helpers';

describe('sites.submissions.access', () => {
  test('public site - no anon access', async () => {
    await expectStatus(401, 'sites/science/access');
  });
  test('public site - any user has access', async () => {
    await expectSuccess('sites/science/access', {
      headers: {
        Authorization: `Bearer ${await getToken(users.steve)}`,
      },
    });
  });
  test('private site - no anon access', async () => {
    await expectStatus(401, 'sites/private/access');
  });
  test('private site - no user access', async () => {
    await expectStatus(401, 'sites/private/access', {
      headers: {
        Authorization: `Bearer ${await getToken(users.steve)}`,
      },
    });
  });
  test('private site - user has access via team', async () => {
    await expectStatus(200, 'sites/private/access', {
      headers: {
        Authorization: `Bearer ${await getToken(users.support)}`,
      },
    });
  });
});
