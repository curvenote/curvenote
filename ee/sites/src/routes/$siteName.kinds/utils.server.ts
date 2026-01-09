import type { Check } from '@curvenote/check-definitions';

export function isCheckArray(value: unknown): value is Check[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string',
    )
  );
}
