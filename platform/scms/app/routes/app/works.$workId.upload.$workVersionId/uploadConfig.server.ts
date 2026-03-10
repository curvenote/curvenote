import type { FileUploadConfig } from '@curvenote/scms-core';

export const WORK_UPLOAD_CONFIGURATION: Record<string, FileUploadConfig> = {
  manuscript: {
    slot: 'manuscript',
    label: 'Manuscript',
    icon: 'file',
    description: 'Upload your manuscript files (.doc, .docx, .pdf) here',
    optional: false,
    multiple: true,
    maxFiles: 20,
    accept:
      '.doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf',
    mimeTypes: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
    ],
    maxSize: 500 * 1024 * 1024, // 500MB
    hideFileCount: false,
    requireLabel: false,
  },
};
