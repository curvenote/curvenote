/**
 * Payload types from @curvenote/common; file metadata from scms-core for pickWordFile.
 */

import type { ConverterPayload, WorkVersionPayload } from '@curvenote/common';
import { CONVERSION_TYPES } from '@curvenote/common';
import type { FileMetadataSectionItem } from '@curvenote/scms-core';

export type {
  WorkVersionMetadataPayload,
  WorkVersionPayload,
  ConversionType,
  ConverterPayload,
} from '@curvenote/common';
export { CONVERSION_TYPES } from '@curvenote/common';
export type { FileMetadataSectionItem, FileMetadataSection } from '@curvenote/scms-core';

const WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCX_EXT = '.docx';

/**
 * Validates payload: workVersion (object), target === 'pdf', conversionType one of CONVERSION_TYPES,
 * required workVersion fields, and metadata as non-null object (for metadata.files).
 */
export function validatePayload(payload: unknown): payload is ConverterPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  if (p.target !== 'pdf') return false;
  const ct = p.conversionType;
  if (typeof ct !== 'string' || !(CONVERSION_TYPES as readonly string[]).includes(ct)) return false;
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
