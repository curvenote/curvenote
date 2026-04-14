/** MIME type for `.docx` as stored on work version `metadata.files` entries. */
export const WORK_VERSION_DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type FileEntryLike = { type?: string; name?: string; path?: string };

/**
 * Whether `metadata.files` includes a PDF (by MIME or `.pdf` / `pdf` name/path).
 */
export function hasPdfInMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const meta = metadata as Record<string, unknown>;
  const files = meta.files;
  if (!files || typeof files !== 'object') return false;
  const entries = Object.values(files) as FileEntryLike[];
  return entries.some((f) => {
    if (!f || typeof f !== 'object') return false;
    const type = f.type?.toLowerCase?.();
    const name = (f.name ?? f.path ?? '')?.toString?.().toLowerCase?.() ?? '';
    return type === 'application/pdf' || name.endsWith('.pdf') || name === 'pdf';
  });
}

/**
 * Whether `metadata.files` includes a Word document (DOCX MIME or `.docx` name/path).
 */
export function hasDocxInMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const meta = metadata as Record<string, unknown>;
  const files = meta.files;
  if (!files || typeof files !== 'object') return false;
  const entries = Object.values(files) as FileEntryLike[];
  return entries.some(
    (f) =>
      f?.type === WORK_VERSION_DOCX_MIME ||
      (typeof f?.name === 'string' && f.name.toLowerCase().endsWith('.docx')) ||
      (typeof f?.path === 'string' && f.path.toLowerCase().endsWith('.docx')),
  );
}
