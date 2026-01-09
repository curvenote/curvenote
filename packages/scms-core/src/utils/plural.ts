/**
 * Creates a plural version of a string to log to the console.
 *
 * `plural('%s book(s)', books)`
 *
 * `plural('%s stitch(es)', 3)`
 *
 * `plural('%s dependenc(y|ies)', deps)`
 *
 * `plural('%s item(s)', 0, { 0: 'No' })` // "No items"
 *
 * If passed an object as the second argument, the number of keys will be used.
 * The options parameter allows custom strings for specific numeric values.
 */
export function plural(
  f: string,
  count?: number | any[] | Record<any, any>,
  options?: { [value: number]: string },
): string {
  const num =
    (typeof count === 'number'
      ? count
      : Array.isArray(count)
        ? count?.length
        : Object.keys(count ?? {}).length) ?? 0;
  const countStr = options?.[num] ?? String(num);
  return f
    .replace('%s', countStr)
    .replace(/\((?:([a-z0-9A-Z-]*)\|)?([a-z0-9A-Z-]*)\)/g, num === 1 ? '$1' : '$2');
}
