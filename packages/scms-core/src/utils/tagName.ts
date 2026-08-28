/** Shortest accepted editorial tag name. */
export const TAG_NAME_MIN_LENGTH = 3;

/** Longest accepted editorial tag name. */
export const TAG_NAME_MAX_LENGTH = 32;

/**
 * Longest accepted editorial tag label. `toTagName` only removes and collapses
 * characters, so a label within this bound always derives a name within
 * {@link TAG_NAME_MAX_LENGTH}.
 */
export const TAG_LABEL_MAX_LENGTH = 32;

/**
 * Derive the URL-safe `name` of an editorial tag from its human `label`.
 *
 * "Blog Post" becomes "blog-post". Accents are folded, other characters are
 * removed, and separators are collapsed and trimmed.
 */
export function toTagName(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/[-_]{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

/** True when `name` is safe to store as `Tag.name`. */
export function isValidTagName(name: string): boolean {
  if (name.length < TAG_NAME_MIN_LENGTH || name.length > TAG_NAME_MAX_LENGTH) {
    return false;
  }
  return /^[a-z0-9][a-z0-9_-]*$/.test(name);
}

/** True when `label` is safe to store as `Tag.label`. */
export function isValidTagLabel(label: string): boolean {
  return label.length > 0 && label.length <= TAG_LABEL_MAX_LENGTH;
}
