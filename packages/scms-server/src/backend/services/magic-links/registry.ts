import type { MagicLinkHandler } from './handlers.js';
import { submissionPreviewHandler } from './handlers/submission-preview.server.js';

// Base magic link handlers (non-extension)
export const baseMagicLinkHandlers: Record<string, MagicLinkHandler> = {
  submission_preview: submissionPreviewHandler,
};
