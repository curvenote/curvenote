import type { FileUploadConfig } from '@curvenote/scms-core';
import { MANUSCRIPT_UPLOAD_ACCEPT, MANUSCRIPT_UPLOAD_MIME_TYPES } from './manuscriptFormats';

export const WORK_UPLOAD_CONFIGURATION: Record<string, FileUploadConfig> = {
  manuscript: {
    slot: 'manuscript',
    label: 'Manuscript',
    icon: 'file',
    description: 'Upload one or more manuscript files (.docx or .pdf), up to 100 MB total',
    optional: false,
    multiple: true,
    accept: MANUSCRIPT_UPLOAD_ACCEPT,
    mimeTypes: [...MANUSCRIPT_UPLOAD_MIME_TYPES],
    maxTotalSize: 100 * 1024 * 1024, // 100 MB total across slot
    hideFileCount: false,
    requireLabel: false,
  },
};
