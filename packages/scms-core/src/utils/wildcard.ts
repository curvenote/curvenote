/**
 * Matches a key against a wildcard pattern where * matches any characters except dots
 * and wildcards are not allowed at the beginning of patterns
 * @param key The key to match
 * @param pattern The wildcard pattern (e.g., "extensions.*.name")
 * @returns true if the key matches the pattern
 */
export function matchesWildcard(key: string, pattern: string): boolean {
  // Disallow patterns that start with * or .*
  if (pattern.startsWith('*') || pattern.startsWith('.*')) {
    return false;
  }

  // Disallow patterns with leading dots, trailing dots, or consecutive dots
  if (pattern.startsWith('.') || pattern.endsWith('.') || pattern.includes('..')) {
    return false;
  }

  // Convert wildcard pattern to regex
  // Escape special regex characters except *
  const escapedPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  // Replace * with regex pattern that matches any characters except dots
  const regexPattern = escapedPattern.replace(/\*/g, '[^.]+');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(key);
}
