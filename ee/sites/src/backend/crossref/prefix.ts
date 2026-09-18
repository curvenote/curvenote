/** A Crossref DOI prefix: "10." followed by four to nine digits. No suffix. */
export const PREFIX_RE = /^10\.\d{4,9}$/;

const LEADING = /^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/|doi\.org\/)/i;

/** The registrant code alone ("5555"): every DOI prefix starts with "10.", so it can be left out. */
const CODE_ONLY = /^\d{4,9}$/;

/**
 * Reduce what a person pastes ("doi:10.5555", "https://doi.org/10.5555/") or types ("5555") to the
 * bare prefix. Returns null when the result is not a DOI prefix, so callers show one form error.
 */
export function normalizePrefix(raw: string): string | null {
  const stripped = raw.trim().replace(LEADING, '').trim().replace(/\/+$/, '');
  const prefix = CODE_ONLY.test(stripped) ? `10.${stripped}` : stripped;
  return PREFIX_RE.test(prefix) ? prefix : null;
}
