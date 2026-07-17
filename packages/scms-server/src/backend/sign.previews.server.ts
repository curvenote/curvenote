import jwt from 'jsonwebtoken';
import { isPast } from 'date-fns';

/** Audience for submission-version preview JWTs (site UIs / render theme). */
export const SUBMISSION_PREVIEW_AUDIENCE = 'scms-preview';

/** Audience for work-version preview JWTs (dedicated work preview theme). */
export const WORK_VERSION_PREVIEW_AUDIENCE = 'scms-work-preview';

/** Preview JWT scope for a work version (path id === scopeId). */
export const WORK_VERSION_PREVIEW_SCOPE = 'work_version';

/** Preview JWT scope for a submission (scopeId === submissionId; path is submissionVersionId). */
export const SUBMISSION_PREVIEW_SCOPE = 'submission';

export interface PreviewSignatureClaims {
  iss: string;
  aud: string;
  exp: number;
  scope: string;
  scopeId: string;
}

/**
 * Mint a preview JWT for a submission-version web article.
 * Claims: aud `scms-preview`, scope `submission`, scopeId = submissionId.
 */
export function createPreviewToken(submissionId: string, issuer: string, key: string) {
  const claims: PreviewSignatureClaims = {
    iss: issuer,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 5, // 5 days until we get magic links - 24 hours
    aud: SUBMISSION_PREVIEW_AUDIENCE,
    scope: SUBMISSION_PREVIEW_SCOPE,
    scopeId: submissionId,
  };

  return jwt.sign(claims, key, {
    algorithm: 'HS256',
  });
}

/**
 * Mint a preview JWT for a work-version web article (no submission/site required).
 * Path: `/previews/{workVersionId}?preview={token}` with aud `scms-work-preview`.
 */
export function createWorkVersionPreviewToken(workVersionId: string, issuer: string, key: string) {
  const claims: PreviewSignatureClaims = {
    iss: issuer,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 5,
    aud: WORK_VERSION_PREVIEW_AUDIENCE,
    scope: WORK_VERSION_PREVIEW_SCOPE,
    scopeId: workVersionId,
  };

  return jwt.sign(claims, key, {
    algorithm: 'HS256',
  });
}

export function verifyPreviewToken(signature: string, issuer: string, key: string) {
  const claims = jwt.verify(signature, key, {
    algorithms: ['HS256'],
  }) as PreviewSignatureClaims;
  const { iss, exp } = claims;
  if (iss !== issuer) throw new Error(`Invalid preview token issuer ${iss}`);
  if (isPast(new Date(exp * 1000))) throw new Error('Preview signature has expired');
  return claims;
}

/**
 * Build a work-version preview URL for the dedicated preview theme.
 * `{baseUrl}/previews/{workVersionId}?preview={signature}`
 */
export function createWorkVersionPreviewUrl(
  baseUrl: string,
  workVersionId: string,
  signature: string,
): string {
  const trimmed = baseUrl.replace(/\/$/, '');
  return `${trimmed}/previews/${workVersionId}?preview=${encodeURIComponent(signature)}`;
}
