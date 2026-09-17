/** A Crossref DOI prefix: "10." followed by four to nine digits. No suffix. */
export const PREFIX_RE = /^10\.\d{4,9}$/;

const LEADING = /^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/|doi\.org\/)/i;

/**
 * Reduce what a person pastes ("doi:10.5555", "https://doi.org/10.5555/") to the bare prefix.
 * Returns null when the result is not a DOI prefix, so callers show one form error.
 */
export function normalizePrefix(raw: string): string | null {
  const stripped = raw.trim().replace(LEADING, '').trim().replace(/\/+$/, '');
  return PREFIX_RE.test(stripped) ? stripped : null;
}
