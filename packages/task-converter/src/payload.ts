/**
 * Payload and WorkVersion types for the SCMS converter.
 * Aligned with WorkVersion Prisma model and metadata.files shape.
 */

/** File entry in metadata.files (minimal shape for converter). */
export type FileMetadataSectionItem = {
  name: string;
  size: number;
  type: string;
  path: string;
  md5: string;
  uploadDate: string;
  slot: string;
  label?: string;
  order?: number;
  signedUrl?: string;
};

/** metadata.files is Record<path, FileMetadataSectionItem> */
export type FileMetadataSection = {
  files: Record<string, FileMetadataSectionItem>;
};

/** workVersion.metadata: version + files (and optional checks, etc.) */
export type WorkVersionMetadataPayload = {
  version: number;
  files?: Record<string, FileMetadataSectionItem>;
  checks?: { enabled: string[] };
  [key: string]: unknown;
};

/** WorkVersion as received in payload (no relations). */
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

/** Message payload (decoded from Pub/Sub message.data). */
export type ConverterPayload = {
  taskId?: string;
  target: 'pdf';
  conversionType: 'pandoc-myst';
  filename?: string;
  workVersion: WorkVersionPayload;
};

const WORD_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCX_EXT = '.docx';

/**
 * Validates payload: workVersion (object), target === 'pdf', conversionType === 'pandoc-myst',
 * required workVersion fields, and metadata as non-null object (for metadata.files).
 */
export function validatePayload(payload: unknown): payload is ConverterPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  if (p.target !== 'pdf') return false;
  if (p.conversionType !== 'pandoc-myst') return false;
  const wv = p.workVersion;
  if (!wv || typeof wv !== 'object') return false;
  const w = wv as Record<string, unknown>;
  if (
    typeof w.id !== 'string' ||
    typeof w.work_id !== 'string' ||
    typeof w.title !== 'string' ||
    !Array.isArray(w.authors)
  ) {
    return false;
  }
  if (w.metadata !== null && typeof w.metadata !== 'object') return false;
  // Pipeline needs metadata.files to pick Word doc; require metadata to be a non-null object
  if (!w.metadata || typeof w.metadata !== 'object') return false;
  return true;
}

/**
 * Returns the first file in metadata.files that is a Word document
 * (by MIME type or .docx extension). Defensive: requires metadata and metadata.files to be objects.
 */
export function pickWordFile(
  workVersion: WorkVersionPayload,
): FileMetadataSectionItem & { pathKey: string } {
  const meta = workVersion.metadata;
  if (!meta || typeof meta !== 'object') {
    throw new Error('workVersion.metadata is missing or not an object');
  }
  const files = meta.files;
  if (!files || typeof files !== 'object') {
    throw new Error('workVersion.metadata.files is missing or not an object');
  }
  for (const [pathKey, entry] of Object.entries(files)) {
    if (!entry || typeof entry !== 'object') continue;
    const type = (entry as FileMetadataSectionItem).type;
    const name = (entry as FileMetadataSectionItem).name ?? '';
    const pathStr = (entry as FileMetadataSectionItem).path ?? '';
    if (
      type === WORD_MIME ||
      name.toLowerCase().endsWith(DOCX_EXT) ||
      pathStr.toLowerCase().endsWith(DOCX_EXT)
    ) {
      return { ...(entry as FileMetadataSectionItem), pathKey };
    }
  }
  throw new Error('No Word document found in metadata.files');
}
