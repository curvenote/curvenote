import { coerceToObject } from '@curvenote/scms-core';

/**
 * Activity.data payload for work timeline "started" events, derived from the job row.
 */
export function workActivityDataForJob(
  activityType: string | null | undefined,
  payload: unknown,
): Record<string, unknown> | undefined {
  const record = coerceToObject(payload);
  if (!record || !activityType) return undefined;

  if (activityType === 'CONVERTER_TASK_STARTED') {
    return {
      converter: {
        target: typeof record.target === 'string' ? record.target : 'pdf',
        type:
          typeof record.conversion_type === 'string'
            ? record.conversion_type
            : 'docx-pandoc-myst-pdf',
      },
    };
  }

  if (activityType === 'CHECK_STARTED' && record.check != null) {
    return { check: record.check };
  }

  return undefined;
}
