/**
 * Shared web-converter payload helpers for timeline + Retry.
 * Classification and retry conversion_type selection live here so loaders,
 * actions, and UI stay in sync when new web pipelines are added.
 */

/** Preferred Curvenote web conversion types (enqueue these). */
export const WEB_CONVERSION_TYPES = ['myst-curvenote-web', 'docx-pd-curvenote-web'] as const;

export type WebConversionType = (typeof WEB_CONVERSION_TYPES)[number];

/** Default when a web job has no conversion_type (legacy rows). */
export const DEFAULT_WEB_CONVERSION_TYPE: WebConversionType = 'myst-curvenote-web';

/**
 * Accepted payload values for web pipelines, including legacy aliases.
 * Add new web handlers here; map aliases to a preferred type in
 * {@link WEB_CONVERSION_TYPE_ALIASES}.
 */
const WEB_CONVERSION_TYPE_VALUES = new Set<string>([
  ...WEB_CONVERSION_TYPES,
  'docx-pandoc-myst-web',
]);

/** Prefer Curvenote names when re-enqueueing. */
const WEB_CONVERSION_TYPE_ALIASES: Record<string, WebConversionType> = {
  'docx-pandoc-myst-web': 'docx-pd-curvenote-web',
};

export const WEB_CONVERSION_IN_FLIGHT = new Set(['QUEUED', 'SCHEDULED', 'RUNNING']);

export function converterPayloadRecord(payload: unknown): Record<string, unknown> | null {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

/** True when payload is a converter task targeting web (any conversion_type). */
export function isWebConversionPayload(payload: unknown): boolean {
  return converterPayloadRecord(payload)?.target === 'web';
}

export function isWebConversionType(type: string): boolean {
  return WEB_CONVERSION_TYPE_VALUES.has(type);
}

/**
 * Canonical conversion_type to re-enqueue for a failed/cancelled web job.
 * Unknown or missing types fall back to {@link DEFAULT_WEB_CONVERSION_TYPE}.
 */
export function resolveWebConversionTypeForRetry(payload: unknown): WebConversionType {
  const raw = converterPayloadRecord(payload)?.conversion_type;
  if (typeof raw !== 'string' || !isWebConversionType(raw)) {
    return DEFAULT_WEB_CONVERSION_TYPE;
  }
  return WEB_CONVERSION_TYPE_ALIASES[raw] ?? (raw as WebConversionType);
}

export type LinkedConverterJobRef = {
  job: {
    id: string;
    status: string;
    job_type: string;
    payload: unknown;
    date_created?: string | Date;
  };
};

export function findInFlightWebConversionJob(
  rows: LinkedConverterJobRef[],
): LinkedConverterJobRef | undefined {
  return rows.find((row) => {
    if (row.job.job_type !== 'CONVERTER_TASK') return false;
    if (!WEB_CONVERSION_IN_FLIGHT.has(row.job.status)) return false;
    return isWebConversionPayload(row.job.payload);
  });
}

/** Latest CONVERTER_TASK with target=web (by date_created desc when available). */
export function pickLatestWebConversionLinkedJob(
  rows: LinkedConverterJobRef[],
): LinkedConverterJobRef | undefined {
  const web = rows.filter(
    (row) => row.job.job_type === 'CONVERTER_TASK' && isWebConversionPayload(row.job.payload),
  );
  if (web.length === 0) return undefined;
  return [...web].sort((a, b) => {
    const aDate = String(a.job.date_created ?? '');
    const bDate = String(b.job.date_created ?? '');
    return bDate.localeCompare(aDate);
  })[0];
}

export function resolveRetryWebConversionTypeFromLinkedJobs(
  rows: LinkedConverterJobRef[],
): WebConversionType {
  const latest = pickLatestWebConversionLinkedJob(rows);
  return resolveWebConversionTypeForRetry(latest?.job.payload);
}
