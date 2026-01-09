import { z } from 'zod';

/**
 * Base schema for file information
 */
export const FileBaseSchema = z.object({
  name: z.string(),
  size: z.number(),
  type: z.string(),
  path: z.string(),
  md5: z.string(),
});

/**
 * Schema for file metadata section items that extends FileBaseSchema
 */
export const FileMetadataSectionItemSchema = FileBaseSchema.extend({
  uploadDate: z.string(),
  slot: z.string(),
  label: z.string().max(100).optional(),
  order: z.number().int().positive().optional(), // Explicit ordering within slot
});

/**
 * Schema for file metadata section containing a map of files
 */
export const FileMetadataSectionSchema = z.object({
  files: z.record(z.string(), FileMetadataSectionItemSchema),
});

export type FileBase = z.infer<typeof FileBaseSchema>;
export type FileMetadataSectionItem = z.infer<typeof FileMetadataSectionItemSchema>;
export type FileMetadataSection = z.infer<typeof FileMetadataSectionSchema>;

/**
 * Schema for file upload configuration.
 * Each slot represents a specific type of file that can be uploaded (e.g., manuscript, figures, etc.).
 *
 * Fields:
 * - slot: Unique identifier for the upload slot (e.g., 'manuscript', 'figures')
 * - label: Display name shown to users for this upload type
 * - description: Optional help text explaining what files should be uploaded
 * - optional: Whether this upload is required (false) or optional (true)
 * - multiple: Whether multiple files can be uploaded in this slot
 * - maxFiles: Maximum number of files allowed in this slot (undefined = no limit)
 * - accept: Comma-separated list of file extensions to accept (e.g., '.pdf,.docx'), supplied to the <input> element
 * - mimeTypes: Array of allowed MIME types (e.g., ['application/pdf']), used in server-side validation
 * - maxSize: Maximum file size in bytes (e.g., 10MB = 10 * 1024 * 1024)
 * - requireLabel: Whether a label is required for this slot
 *
 * Note: If accept and mimeTypes are undefined, any file type is allowed.
 * If maxSize is undefined, there is no size limit.
 */
export const FileUploadConfigSchema = z.object({
  slot: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  description: z.string().optional(),
  optional: z.boolean().optional(),
  multiple: z.boolean().optional(),
  maxFiles: z.number().int().positive().optional(),
  accept: z.string().optional(),
  mimeTypes: z.array(z.string()).optional(),
  maxSize: z.number().int().positive().optional(),
  hideFileCount: z.boolean().optional(),
  requireLabel: z.boolean().optional(),
  ignoreDuplicates: z.boolean().optional(),
});

export type FileUploadConfig = z.infer<typeof FileUploadConfigSchema>;

/**
 * Schema for per-file error information
 */
export const PerFileErrorSchema = z.object({
  path: z.string(),
  error: z.string(),
  details: z.record(z.string(), z.any()).optional(),
});

export type PerFileError = z.infer<typeof PerFileErrorSchema>;
