export function coerceToObject(value: any) {
  if (value == null) {
    return {};
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return { value };
}

export function coerceToObjectOrNull(value: unknown): object | null {
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return null;
}
