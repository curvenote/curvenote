import type { UploadFactPresence } from '../modules/extensions/types.js';

/** Minimal preview fields needed to infer image presence for upload analysis. */
export type PreviewImagePresenceInput = {
  path: string;
  figures: readonly unknown[];
  previewUnavailable?: boolean;
  figuresExtractionSkipped?: boolean;
  figuresPending?: boolean;
};

export function resolvePreviewImagePresence(
  previewCandidatePaths: string[],
  previews: PreviewImagePresenceInput[],
): UploadFactPresence {
  if (previewCandidatePaths.length === 0) return 'unknown';
  const previewPaths = new Set(previews.map((preview) => preview.path));
  const hasMissingPreview = previewCandidatePaths.some((path) => !previewPaths.has(path));
  if (hasMissingPreview || previews.some((preview) => preview.previewUnavailable === true)) {
    return 'unknown';
  }
  if (previews.some((preview) => preview.figuresPending === true)) {
    return 'unknown';
  }
  if (previews.some((preview) => preview.figures.length > 0)) {
    return 'present';
  }
  if (previews.some((preview) => preview.figuresExtractionSkipped === true)) {
    return 'unknown';
  }
  const allConfidentlyAbsent = previews.every(
    (preview) => preview.figuresExtractionSkipped === false && preview.figures.length === 0,
  );
  return allConfidentlyAbsent && previews.length > 0 ? 'absent' : 'unknown';
}
