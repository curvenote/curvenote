import { doi as doiUtils } from 'doi-utils';
import { parseDoiFormat, type ParseDoiFormatResult } from './doiFormat.js';

export type { ParseDoiFormatResult as ValidateDoiResult };

function isDoiReachableStatus(status: number): boolean {
  return status === 301 || status === 302 || (status >= 200 && status < 300);
}

/** Persisted save: valid format only; reachability is not required. */
export function validateAndNormalizeDoi(raw: string): ParseDoiFormatResult {
  return parseDoiFormat(raw);
}

export type CheckDoiReachabilityResult = { ok: true } | { ok: false; error: string };

/** HEAD check against doi.org for preview validation in the dialog. */
export async function checkDoiReachability(raw: string): Promise<CheckDoiReachabilityResult> {
  const format = parseDoiFormat(raw);
  if (!format.ok) {
    return { ok: false, error: format.error };
  }

  const url = doiUtils.buildUrl(raw.trim());
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

  return { ok: true };
}
