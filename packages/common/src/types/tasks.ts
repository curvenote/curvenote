/**
 * Payload types for SCMS async tasks (e.g. task-converter).
 * Consumed by @curvenote/task-converter and @curvenote/scms-server.
 */

/** workVersion.metadata: version + files (and optional checks, etc.). */
export type WorkVersionMetadataPayload = {
  version: number;
  files?: Record<string, unknown>;
  checks?: { enabled: string[] };
  [key: string]: unknown;
};

/** WorkVersion as sent in task payloads (snake_case, dates as ISO strings). */
export type WorkVersionPayload = {
  id: string;
  work_id: string;
  date_created: string;
  date_modified: string;
  draft: boolean;
  cdn: string | null;
  cdn_key: string | null;
  title: string;
  description: string | null;
  authors: string[];
  author_details: unknown[];
  date: string | null;
  doi: string | null;
  canonical: boolean | null;
  metadata: WorkVersionMetadataPayload | null;
  occ: number;
};

/**
 * Supported HAT conversion types (doc → PDF / web pipelines).
 * - docx-pandoc-myst-pdf: Word → Pandoc → MyST/Typst → PDF
 * - docx-lowriter-pdf: Word → LibreOffice Writer → PDF
 * - docx-pandoc-myst-web: Word → Pandoc → MyST site → CDN
 */
export type ConversionType = 'docx-pandoc-myst-pdf' | 'docx-lowriter-pdf' | 'docx-pandoc-myst-web';

export type ConverterTarget = 'pdf' | 'web';

export const CONVERSION_TYPES: readonly ConversionType[] = [
  'docx-pandoc-myst-pdf',
  'docx-lowriter-pdf',
  'docx-pandoc-myst-web',
] as const;

export const CONVERTER_TARGETS: readonly ConverterTarget[] = ['pdf', 'web'] as const;

/** Expected payload target for each conversion type. */
export const CONVERSION_TYPE_TARGET: Record<ConversionType, ConverterTarget> = {
  'docx-pandoc-myst-pdf': 'pdf',
  'docx-lowriter-pdf': 'pdf',
  'docx-pandoc-myst-web': 'web',
};

/** Message payload for converter task (decoded from Pub/Sub message.data). */
export type ConverterPayload = {
  taskId?: string;
  target: ConverterTarget;
  conversionType: ConversionType;
  filename?: string;
  workVersion: WorkVersionPayload;
};
