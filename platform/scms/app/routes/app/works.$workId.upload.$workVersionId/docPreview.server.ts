/**
 * Server-only re-exports for the upload route.
 *
 * Importing `@curvenote/scms-doc-preview` directly from `route.tsx` pulls Node-only
 * deps (storage, pdfjs, etc.) into the Vite client graph. React Router treats
 * `*.server.ts` modules as server-only, so the route must go through this boundary.
 */
export {
  handleFetchPreviewsIntent,
  handleFetchPreviewFiguresIntent,
  deletePreviewArtifactsForVersion,
  persistThumbnailListingForVersion,
  signPreviewFigures,
  readDocumentPreviewsFromObjectTable,
  extractMetadataFromPreviews,
  materializeSelectedThumbnail,
  summarizePreviewCandidateFiles,
  sanitizeUploadFlowFailureReason,
  normalizeUploadFlowTrigger,
  resolveMetadataExtractionTrigger,
  trackDocumentPreviewStarted,
  trackDocumentPreviewAnalytics,
  trackMetadataExtractionStarted,
  trackMetadataExtractionAnalytics,
} from '@curvenote/scms-doc-preview';
