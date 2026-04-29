export type StringReplacementKey = 'work';

export type StringReplacements = Record<StringReplacementKey, string>;

export const DEFAULT_STRING_REPLACEMENTS: StringReplacements = {
  work: 'work',
};

export function sanitizeStringReplacements(input: unknown): StringReplacements {
  const config = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};

  return {
    work:
      typeof config.work === 'string' && config.work.trim().length > 0
        ? config.work.trim()
        : DEFAULT_STRING_REPLACEMENTS.work,
  };
}

export function capitalize(value: string): string {
  if (!value) return value;
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}
