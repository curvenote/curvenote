import { doi as doiUtils } from 'doi-utils';

export type ValidateDoiResult = { ok: true; normalized: string } | { ok: false; error: string };

function isDoiReachableStatus(status: number): boolean {
  return status === 301 || status === 302 || (status >= 200 && status < 300);
}

/**
 * Normalize, syntactically validate, and verify reachability of a DOI input.
 * Accepts prefix/suffix or a full doi.org URL. Returns normalized prefix/suffix only.
 */
export async function validateAndNormalizeDoi(raw: string): Promise<ValidateDoiResult> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'DOI is required' };
  }

  if (!doiUtils.validate(trimmed)) {
    return { ok: false, error: 'Invalid DOI format' };
  }

  const normalized = doiUtils.normalize(trimmed);
  if (!normalized) {
    return { ok: false, error: 'Invalid DOI format' };
  }

  const url = doiUtils.buildUrl(trimmed);
  if (!url) {
    return { ok: false, error: 'Invalid DOI format' };
  }

  try {
    const resp = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    if (!isDoiReachableStatus(resp.status)) {
      return { ok: false, error: 'DOI does not resolve to a reachable URL' };
    }
  } catch {
    return { ok: false, error: 'DOI lookup failed' };
  }

  return { ok: true, normalized };
}
