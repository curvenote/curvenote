/**
 * Collects every string leaf from a nested object tree (e.g. scope definitions keyed by area).
 */
export function flattenScopeTree(tree: unknown): string[] {
  const values: string[] = [];
  const visit = (node: unknown) => {
    if (typeof node === 'string') {
      values.push(node);
      return;
    }
    if (node && typeof node === 'object') {
      for (const value of Object.values(node as Record<string, unknown>)) {
        visit(value);
      }
    }
  };
  visit(tree);
  return Array.from(new Set(values)).sort();
}
