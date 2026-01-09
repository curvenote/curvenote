export type ExtractFieldType<T, K extends string> = T extends { [P in K]: infer V } ? V : never;

export function getFetcherField<T, K extends string>(
  maybeData: T | undefined | null,
  field: K,
): ExtractFieldType<T, K> | undefined {
  return maybeData && typeof maybeData === 'object' && field in maybeData
    ? (maybeData as any)[field]
    : undefined;
}
