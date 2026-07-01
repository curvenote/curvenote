import { parseDoiFormat, type ParseDoiFormatResult } from './doiFormat.js';

export type { ParseDoiFormatResult as ValidateDoiResult };

/** Persisted save: valid format only. */
export function validateAndNormalizeDoi(raw: string): ParseDoiFormatResult {
  return parseDoiFormat(raw);
}
