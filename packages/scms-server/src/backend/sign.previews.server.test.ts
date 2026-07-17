// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  WORK_VERSION_PREVIEW_AUDIENCE,
  WORK_VERSION_PREVIEW_SCOPE,
  createWorkVersionPreviewToken,
  createWorkVersionPreviewUrl,
  verifyPreviewToken,
} from './sign.previews.server.js';

describe('work version preview tokens', () => {
  const issuer = 'http://localhost:3031';
  const key = 'test-signing-secret';
  const workVersionId = '11111111-1111-1111-1111-111111111111';

  it('mints a token with work_version scope and scms-work-preview audience', () => {
    const token = createWorkVersionPreviewToken(workVersionId, issuer, key);
    const claims = verifyPreviewToken(token, issuer, key);
    expect(claims.aud).toBe(WORK_VERSION_PREVIEW_AUDIENCE);
    expect(claims.scope).toBe(WORK_VERSION_PREVIEW_SCOPE);
    expect(claims.scopeId).toBe(workVersionId);
    expect(claims.iss).toBe(issuer);
  });

  it('builds the preview theme URL with encoded token', () => {
    const token = createWorkVersionPreviewToken(workVersionId, issuer, key);
    expect(createWorkVersionPreviewUrl('http://localhost:3810/', workVersionId, token)).toBe(
      `http://localhost:3810/previews/${workVersionId}?preview=${encodeURIComponent(token)}`,
    );
  });

  it('rejects tokens with the wrong issuer', () => {
    const token = createWorkVersionPreviewToken(workVersionId, issuer, key);
    expect(() => verifyPreviewToken(token, 'http://other', key)).toThrow(/issuer/);
  });

  it('round-trips through jwt.verify with HS256', () => {
    const token = createWorkVersionPreviewToken(workVersionId, issuer, key);
    const payload = jwt.verify(token, key, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    expect(payload.aud).toBe(WORK_VERSION_PREVIEW_AUDIENCE);
  });
});
