import type { FileUploadConfig } from '@curvenote/scms-core';

export const WORK_UPLOAD_CONFIGURATION: Record<string, FileUploadConfig> = {
  manuscript: {
    slot: 'manuscript',
    label: 'Manuscript',
    icon: 'file',
    description: 'Upload one manuscript file (.doc, .docx, or .pdf), up to 50 MB',
    optional: false,
    multiple: false,
    maxFiles: 1,
    accept:
      '.doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf',
    mimeTypes: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
    hideFileCount: true,
    requireLabel: false,
  },
};
