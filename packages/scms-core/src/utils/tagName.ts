/** Shortest accepted editorial tag name. */
export const TAG_NAME_MIN_LENGTH = 3;

/**
 * Derive the URL-safe `name` of an editorial tag from its human `label`.
 *
 * "Blog Post" becomes "blog-post". Accents are folded, other characters are
 * removed, and separators are collapsed and trimmed.
 */
export function toTagName(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

/** True when `name` is safe to store as `Tag.name`. */
export function isValidTagName(name: string): boolean {
  if (name.length < TAG_NAME_MIN_LENGTH) return false;
  return /^[a-z0-9][a-z0-9_-]*$/.test(name);
}
