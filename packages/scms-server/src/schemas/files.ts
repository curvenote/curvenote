/**
 * File-related Zod schemas describing the shape of file metadata
 * stored in JSON fields on WorkVersion.metadata and Site.data.
 *
 * The canonical definitions live in @curvenote/scms-core (because scms-core's
 * own UI components depend on them and cannot import from scms-server).
 * This module re-exports them so that server-side code has a single
 * authoritative import location under `schemas/`.
 */
export {
  FileBaseSchema,
  FileMetadataSectionItemSchema,
  FileMetadataSectionSchema,
  type FileBase,
  type FileMetadataSectionItem,
  type FileMetadataSection,
} from '@curvenote/scms-core';
