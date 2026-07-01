import { doi as doiUtils } from 'doi-utils';

export type ParseDoiFormatResult = { ok: true; normalized: string } | { ok: false; error: string };

/** Syntactic DOI validation and normalization (prefix/suffix or doi.org URL). */
export function parseDoiFormat(raw: string): ParseDoiFormatResult {
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

  return { ok: true, normalized };
}
