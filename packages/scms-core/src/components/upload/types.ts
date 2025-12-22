import type { UploadStagingDTO } from '@curvenote/common';
import type { GeneralError } from '../../backend/types.js';
import type { FileBase, PerFileError } from '../../backend/uploads/schema.js';

/**
 * Interface for file upload status and progress
 */
interface FileStatus {
  status: 'pending' | 'staged' | 'uploading' | 'uploaded' | 'completed' | 'error';
  progress: number;
  error?: {
    message: string;
    details?: Record<string, any>;
  };
}

/**
 * Interface for a file being uploaded
 */
export interface FileUpload extends FileBase, FileStatus {
  file?: File;
  signedUrl?: string;
  label?: string;
  order?: number; // Explicit ordering within slot
  uploadDate?: string; // Upload timestamp for backward compatibility
}

/**
 * Represents the state of all files in the upload process
 */
export type FileState = {
  [path: string]: FileUpload;
};

export type StageResponse = UploadStagingDTO & {
  errorItems?: PerFileError[];
  error?: GeneralError;
};
