/**
 * Shared rule for which uploaded files participate in document preview /
 * fetch-previews / metadata extraction. Safe to import from client or server
 * (no .server-only deps).
 *
 * A file is a preview candidate when it falls in the intersection of:
 *  - A: formats officeparser can parse (see OFFICEPARSER_SUPPORTED_FORMATS), and
 *  - B: the MIME types the manuscript dropzone accepts (MANUSCRIPT_UPLOAD_MIME_TYPES).
 *
 * Today that intersection is {docx, pdf}. Widening the dropzone (set B) to another
 * officeparser-supported format makes it previewable automatically.
 */

import {
  MANUSCRIPT_UPLOAD_MIME_TYPES,
  OCTET_STREAM_MIME,
  officeParserFormatForPath,
} from '../manuscriptFormats';

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
