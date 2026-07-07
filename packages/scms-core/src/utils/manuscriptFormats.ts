/**
 * Single source of truth for which manuscript documents we accept and preview.
 *
 * Two independent sets are defined here:
 *
 *  - A: the document formats officeparser can parse (.docx, .pptx, .xlsx, .odt,
 *       .odp, .ods, .pdf, .rtf). See the officeparser `SupportedFileType` type.
 *  - B: the MIME types the manuscript dropzone actually accepts.
 *
 * Preview/metadata-extraction runs on the *intersection* (A ∩ B): a file must be
 * parseable by officeparser AND allowed by the dropzone. Today that intersection
 * is {docx, pdf}; widening the dropzone (set B) automatically widens previews to
 * any newly-allowed format that officeparser already supports.
 *
 * This module is import-safe from both client and server (pure constants, no
 * .server-only deps).
 */

/** A single officeparser-supported format: its file extensions and canonical MIME types. */
export interface OfficeParserFormat {
  /** Lowercased file extensions including the leading dot. */
  extensions: string[];
  /** Lowercased canonical MIME types for the format. */
  mimeTypes: string[];
}

/**
 * Set A — formats officeparser (v6) can parse into an AST.
 * Word OOXML keeps the full family (.docx/.docm/.dotx/.dotm) since they share the
 * same ZIP/OOXML structure officeparser reads.
 */
export const OFFICEPARSER_SUPPORTED_FORMATS: OfficeParserFormat[] = [
  {
    extensions: ['.docx', '.docm', '.dotx', '.dotm'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-word.document.macroenabled.12', // .docm
      'application/vnd.openxmlformats-officedocument.wordprocessingml.template', // .dotx
      'application/vnd.ms-word.template.macroenabled.12', // .dotm
    ],
  },
  {
    extensions: ['.pptx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  },
  {
    extensions: ['.xlsx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  },
  { extensions: ['.odt'], mimeTypes: ['application/vnd.oasis.opendocument.text'] },
  { extensions: ['.odp'], mimeTypes: ['application/vnd.oasis.opendocument.presentation'] },
  { extensions: ['.ods'], mimeTypes: ['application/vnd.oasis.opendocument.spreadsheet'] },
  { extensions: ['.pdf'], mimeTypes: ['application/pdf'] },
  { extensions: ['.rtf'], mimeTypes: ['application/rtf', 'text/rtf'] },
].map((format) => ({
  extensions: format.extensions.map((ext) => ext.toLowerCase()),
  mimeTypes: format.mimeTypes.map((mime) => mime.toLowerCase()),
}));

/**
 * Set B — MIME types the manuscript dropzone accepts. Keep this in sync with the
 * `accept` string below; both drive `WORK_UPLOAD_CONFIGURATION.manuscript`.
 */
export const MANUSCRIPT_UPLOAD_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/pdf', // .pdf
] as const;

/** `accept` attribute for the manuscript dropzone (extensions + MIME types from set B). */
export const MANUSCRIPT_UPLOAD_ACCEPT = ['.docx', '.pdf', ...MANUSCRIPT_UPLOAD_MIME_TYPES].join(
  ',',
);

/** Some stacks send generic binary when the real MIME type is unknown. */
export const OCTET_STREAM_MIME = 'application/octet-stream';

function normalizeExtension(pathOrName: string): string {
  const lower = pathOrName.toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot >= 0 ? lower.slice(dot) : '';
}

/** Find the officeparser format (set A) that matches a file's path/name extension. */
export function officeParserFormatForPath(pathOrName: string): OfficeParserFormat | undefined {
  const ext = normalizeExtension(pathOrName);
  if (!ext) return undefined;
  return OFFICEPARSER_SUPPORTED_FORMATS.find((format) => format.extensions.includes(ext));
}

/**
 * True when officeparser should run a preview for this file.
 *
 * - The path/name extension must belong to an officeparser-supported format (A).
 * - That format must also be accepted by the dropzone (B); we compute the
 *   per-format intersection of its MIME types with `allowedMimeTypes`.
 * - The file's own `type` must be non-empty and either match an allowed MIME type
 *   for the format, or be `application/octet-stream` (unknown binary), in which
 *   case the extension alone is trusted.
 *
 * @param file file metadata (path/name + MIME type)
 * @param allowedMimeTypes the dropzone-allowed MIME types (set B); defaults to the
 *   manuscript dropzone configuration.
 */
export function isPreviewCandidate(
  file: {
    path?: string;
    name?: string;
    type?: string;
  },
  allowedMimeTypes: readonly string[] = MANUSCRIPT_UPLOAD_MIME_TYPES,
): boolean {
  const pathOrName = file.path ?? file.name ?? '';
  const format = officeParserFormatForPath(pathOrName);
  if (!format) return false;

  const allowed = new Set(allowedMimeTypes.map((mime) => mime.toLowerCase().trim()));
  // Per-format intersection of officeparser MIME types (A) and dropzone MIME types (B).
  const allowedForFormat = format.mimeTypes.filter((mime) => allowed.has(mime));
  if (allowedForFormat.length === 0) return false;

  const mime = (file.type ?? '').toLowerCase().trim();
  if (mime === '') return false;
  if (mime === OCTET_STREAM_MIME) return true;

  return allowedForFormat.includes(mime);
}
