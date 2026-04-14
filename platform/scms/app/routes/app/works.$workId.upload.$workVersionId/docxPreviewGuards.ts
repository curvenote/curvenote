/**
 * Shared rules for which uploaded files participate in Word OOXML preview / fetch-previews.
 * Safe to import from client or server (no .server-only deps).
 *
 * officeparser can parse several office formats; this pipeline is only for Word OOXML
 * packages (.docx family), not PDF/PPTX/XLSX.
 */

/** MIME types for Word Open XML (ECMA-376 / ISO 29500) — same ZIP/XML family as .docx */
const WORD_OOXML_MIMES = new Set(
  [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-word.document.macroenabled.12', // .docm
    'application/vnd.openxmlformats-officedocument.wordprocessingml.template', // .dotx
    'application/vnd.ms-word.template.macroenabled.12', // .dotm
  ].map((m) => m.toLowerCase()),
);

const PDF_MIME = 'application/pdf';

/** Some stacks still use generic binary when the real type is unknown */
const OCTET_STREAM = 'application/octet-stream';

const WORD_OOXML_EXTENSIONS = ['.docx', '.docm', '.dotx', '.dotm'] as const;

function pathEndsWithWordOpenXml(pathOrName: string): boolean {
  const p = pathOrName.toLowerCase();
  return WORD_OOXML_EXTENSIONS.some((ext) => p.endsWith(ext));
}

/** @deprecated Use pathEndsWithWordOpenXml / isDocxPreviewCandidate; kept for narrow ".docx" checks if needed */
export function isDocxPath(pathOrName: string): boolean {
  return pathOrName.toLowerCase().endsWith('.docx');
}

/**
 * True when we should run officeparser preview for this file.
 *
 * - Path or name must end with a Word OOXML extension (.docx, .docm, .dotx, .dotm).
 * - `type` must be non-empty and must be a Word OOXML MIME, or `application/octet-stream`.
 * - `application/pdf` is never allowed.
 */
export function isDocxPreviewCandidate(file: {
  path?: string;
  name?: string;
  type?: string;
}): boolean {
  const pathOrName = file.path ?? file.name ?? '';
  if (!pathEndsWithWordOpenXml(pathOrName)) return false;

  const mime = (file.type ?? '').toLowerCase().trim();

  if (mime === '') {
    return false;
  }

  if (mime === PDF_MIME) {
    return false;
  }

  if (mime === OCTET_STREAM) {
    return true;
  }

  return WORD_OOXML_MIMES.has(mime);
}
