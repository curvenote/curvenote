import { describe, test, beforeAll, expect } from 'vitest';
import { expectStatus, expectSubmissionVersion, expectSuccess, getToken, users } from './helpers';
import { createPreviewToken } from '@curvenote/scms-server';

describe('previews.get', () => {
  let token: string | undefined;
  let previewSignature: string | undefined;

  beforeAll(async () => {
    token = await getToken(users.support);
    const submissionId = '012a7a68-9040-4309-953d-14df979085c7';
    // const submissionVersionId = '1f099950-976f-4f85-96fe-55db50d69d6b';
    previewSignature = createPreviewToken(
      'science',
      submissionId,
      'http://localhost:3031',
      'qwerty',
    );
  });
  test.each(['previews/submissionVersionId'])(
    'GET /v1/%s - bad auth header - 401',
    async (endpoint: string) => {
      await expectStatus(401, endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer qwerty123456`,
        },
      });
    },
  );
  test.each(['previews/submissionVersionId'])(
    'GET /v1/%s - bad signature - 401',
    async (endpoint: string) => {
      await expectStatus(401, `${endpoint}?preview=qwerty`, {
        method: 'GET',
      });
    },
  );
  test.each(['previews/submissionVersionId'])(
    'GET /v1/%s - no signature - 401',
    async (endpoint: string) => {
      await expectStatus(401, endpoint, {
        method: 'GET',
      });
    },
  );

  test.each(['previews/1f099950-976f-4f85-96fe-55db50d69d6b'])(
    'GET /%s - good signature - 200',
    async (endpoint: string) => {
      expect(previewSignature).toBeTypeOf('string');
      await expectSuccess(`${endpoint}?preview=${previewSignature}`, {
        method: 'GET',
      });
    },
  );
  test('GET /previews/1f099950-976f-4f85-96fe-55db50d69d6b - good auth header - 200', async () => {
    const resp = await expectStatus(200, 'previews/1f099950-976f-4f85-96fe-55db50d69d6b', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const submissionVersion = (await resp.json()) as any;
    expectSubmissionVersion(submissionVersion);
  });
});
