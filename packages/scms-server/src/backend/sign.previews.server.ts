import jwt from 'jsonwebtoken';
import { isPast } from 'date-fns';

export interface PreviewSignatureClaims {
  iss: string;
  aud: string;
  exp: number;
  scope: string;
  scopeId: string;
}

export function createPreviewToken(
  siteName: string,
  submissionId: string,
  issuer: string,
  key: string,
) {
  const claims: PreviewSignatureClaims = {
    iss: issuer,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 5, // 5 days until we get magic links - 24 hours
    aud: siteName,
    scope: 'submission',
    scopeId: submissionId,
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
