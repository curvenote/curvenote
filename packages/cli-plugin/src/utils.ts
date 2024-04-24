import type { VFile } from 'vfile';

export function validateStringOptions(
  vfile: VFile,
  fieldName: string,
  field: unknown,
  validValues: string[],
) {
  if (
    field &&
    (typeof field !== 'string' || (typeof field === 'string' && !validValues.includes(field)))
  ) {
    vfile.message(`Invalid ${fieldName} supplied must be one of (${validValues.join(' | ')}).`);
  }
}
