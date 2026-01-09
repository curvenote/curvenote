import { describe, test, expect, beforeAll } from 'vitest';
import { expectStatus, expectSuccess, getToken, users } from './helpers';

describe('works.post', () => {
  let token: string | undefined;
  beforeAll(async () => {
    token = await getToken(users.support);
  });
  test('POST /works - 401', async () => {
    await expectStatus(401, 'works', {
      method: 'POST',
      headers: {
        Authorization: `Bearer qwerty123456`,
      },
      body: JSON.stringify({ any: 'thing' }),
    });
  });
  test('POST /works - bad request', async () => {
    const resp = await expectStatus(400, 'works', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ any: 'thing' }),
    });
    expect(resp.statusText).toEqual('cdn is required (url), key is required (uuid)');
  });
  test('POST /works - create work', async () => {
    const resp = await expectSuccess('works', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cdn: 'https://cdn.curvenote.com',
        key: '15c15e67-3629-4edd-841a-6029a5fa120e',
      }),
    });
    expect(resp.statusText).toEqual('OK');
  });
});
