export function truncate(string: string, limit: number) {
  if (string.length <= limit) {
    return string;
  }
  return string.slice(0, limit) + '...';
}
