import type { FileUploadConfig } from '@curvenote/scms-core';

export const WORK_UPLOAD_CONFIGURATION: Record<string, FileUploadConfig> = {
  manuscript: {
    slot: 'manuscript',
    label: 'Manuscript',
    icon: 'file',
    description: 'Upload one or more manuscript files (.docx or .pdf), up to 200 MB total',
    optional: false,
    multiple: true,
    accept:
      '.docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf',
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
    ],
    maxTotalSize: 200 * 1024 * 1024, // 200 MB total across slot
    hideFileCount: false,
    requireLabel: false,
  },
};
