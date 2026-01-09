import { describe, test, expect, beforeAll } from 'vitest';
import { expectStatus, expectSubmission, expectSuccess, getToken, users } from './helpers';

describe('sites.submissions.post', () => {
  let token: string | undefined;
  beforeAll(async () => {
    token = await getToken(users.support);
  });
  test('POST /site/agu/submissions - 401', async () => {
    await expectStatus(401, 'sites/agu/submissions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer qwerty123456`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        work_version_id: '6cec16c6-dccc-4f88-b850-9e2203e86c1c',
        kind: 'Original',
      }),
    });
  });
  test('POST /site/abcdef/submissions - Unknown Site, 404', async () => {
    await expectStatus(404, 'sites/abcdef/submissions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        work_version_id: '6cec16c6-dccc-4f88-b850-9e2203e86c1c',
        kind: 'Original',
      }),
    });
  });
  test('POST /site/{siteName}/submissions - 400 invalid kind', async () => {
    const resp = await expectStatus(400, 'sites/science/submissions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        work_version_id: '6cec16c6-dccc-4f88-b850-9e2203e86c1c',
        kind: 'Totally Made Up Kind',
      }),
    });
    expect(resp.statusText).toEqual('Invalid submission kind for site');
  });
  test.skip('POST /site/{siteName}/submissions - 400 unknown work version', async () => {
    const resp = await expectStatus(404, 'sites/science/submissions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        work_version_id: 'not-a-real-work-version-id',
        kind: 'Original',
      }),
    });
    expect(resp.statusText).toEqual('Invalid submission kind for site');
  });
  test('POST /site/{siteName}/submissions - 200', async () => {
    const resp = await expectSuccess('sites/science/submissions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        work_version_id: 'c29ed7d3-53e5-4b98-ba16-752f16fd9eac',
        kind: 'Original',
      }),
    });

    const submission = (await resp.json()) as any;
    expectSubmission(submission);
  });
  test('POST /site/private/submissions - 200 - caller is on correct team', async () => {
    const resp = await expectSuccess('sites/private/submissions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        work_version_id: 'c29ed7d3-53e5-4b98-ba16-752f16fd9eac',
        kind: 'Original',
      }),
    });

    const submission = (await resp.json()) as any;
    expectSubmission(submission);
  });
  test('POST /site/private/submissions - 401 - caller is on wrong team', async () => {
    await expectStatus(401, 'sites/private/submissions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await getToken(users.steve)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        work_version_id: 'c29ed7d3-53e5-4b98-ba16-752f16fd9eac',
        kind: 'Original',
      }),
    });
  });
});
