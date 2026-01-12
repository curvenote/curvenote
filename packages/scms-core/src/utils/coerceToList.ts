export function coerceToList(value: any) {
  if (value == null) {
    return [];
  }
  if (typeof value === 'object' && Array.isArray(value)) {
    return value;
  }
  return [value];
}
