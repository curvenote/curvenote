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
 * Supported HAT conversion types (doc → PDF pipelines).
 * - docx-pandoc-myst-pdf: Word → Pandoc → MyST/Typst → PDF
 * - docx-lowriter-pdf: Word → LibreOffice Writer → PDF (stub)
 */
export type ConversionType = 'docx-pandoc-myst-pdf' | 'docx-lowriter-pdf';

export const CONVERSION_TYPES: readonly ConversionType[] = [
  'docx-pandoc-myst-pdf',
  'docx-lowriter-pdf',
] as const;

/** Message payload for converter task (decoded from Pub/Sub message.data). */
export type ConverterPayload = {
  taskId?: string;
  target: 'pdf';
  conversionType: ConversionType;
  filename?: string;
  workVersion: WorkVersionPayload;
};
