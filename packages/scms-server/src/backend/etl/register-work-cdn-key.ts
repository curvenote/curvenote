/** Strip trailing slashes for stable prefix comparisons. */
export function normalizeCdnKey(key: string): string {
  return key.trim().replace(/\/+$/, '');
}

/**
 * True when `candidate` is the article root or any blob path under that article
 * folder (e.g. top-level extract or `_updated_versions/…` trees).
 */
export function cdnKeyUnderArticle(articleCdnPrefix: string, candidate: string): boolean {
  const article = normalizeCdnKey(articleCdnPrefix);
  const c = normalizeCdnKey(candidate);
  if (!article || !c) return false;
  if (c === article) return true;
  return c.startsWith(`${article}/`);
}
