import { TrackEvent, type FileMetadataSectionItem } from '@curvenote/scms-core';
import type { Context } from '@curvenote/scms-server';
import type { DocumentPreviewItem } from './fetchPreviews.server.js';
import type { ExtractedMetadata } from './anthropic.server.js';

export type PreviewAnalyticsOutcome = 'completed' | 'failed' | 'skipped';

export type UploadFlowTrigger = 'auto' | 'manual_preview_retry' | 'manual_extract_rerun';

export function normalizeUploadFlowTrigger(
  value: string | undefined,
  fallback: UploadFlowTrigger = 'auto',
): UploadFlowTrigger {
  if (
    value === 'auto' ||
    value === 'manual_preview_retry' ||
    value === 'manual_extract_rerun'
  ) {
    return value;
  }
  return fallback;
}

export function resolveMetadataExtractionTrigger(
  uploadFlowTrigger: string | undefined,
  forceReextract: boolean,
): UploadFlowTrigger {
  const normalized = normalizeUploadFlowTrigger(uploadFlowTrigger);
  if (normalized !== 'auto') return normalized;
  return forceReextract ? 'manual_extract_rerun' : 'auto';
}

export function sanitizeUploadFlowFailureReason(message: string, maxLength = 200): string {
  const trimmed = message.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function summarizePreviewCandidateFiles(
  files: Record<string, FileMetadataSectionItem> | undefined,
  isCandidate: (file: FileMetadataSectionItem) => boolean,
): {
  previewCandidateCount: number;
  fileTypes: string[];
  totalFileSizeBytes: number;
} {
  if (!files || typeof files !== 'object') {
    return { previewCandidateCount: 0, fileTypes: [], totalFileSizeBytes: 0 };
  }
  const candidates = Object.values(files).filter(isCandidate);
  const fileTypes = [...new Set(candidates.map((file) => file.type).filter(Boolean))];
  const totalFileSizeBytes = candidates.reduce(
    (sum, file) => sum + (typeof file.size === 'number' ? file.size : 0),
    0,
  );
  return {
    previewCandidateCount: candidates.length,
    fileTypes,
    totalFileSizeBytes,
  };
}

export function summarizePreviewResults(
  previews: DocumentPreviewItem[],
  previewCandidateCount: number,
): {
  previewsGeneratedCount: number;
  previewsUnavailableCount: number;
  previewsMissingCount: number;
  totalFigureCount: number;
  previewCandidateCount: number;
} {
  const previewsUnavailableCount = previews.filter((preview) => preview.previewUnavailable).length;
  return {
    previewCandidateCount,
    previewsGeneratedCount: previews.length,
    previewsUnavailableCount,
    previewsMissingCount: Math.max(0, previewCandidateCount - previews.length),
    totalFigureCount: previews.reduce((sum, preview) => sum + preview.figures.length, 0),
  };
}

/** Sum extracted figure thumbnails when extraction ran; omit when skipped or unknown. */
export function extractedImageCountWhenAvailable(
  previews: DocumentPreviewItem[],
): number | undefined {
  const withExtraction = previews.filter(
    (preview) => !preview.previewUnavailable && preview.figuresExtractionSkipped !== true,
  );
  if (withExtraction.length === 0) return undefined;
  return withExtraction.reduce((sum, preview) => sum + preview.figures.length, 0);
}

export function classifyPreviewOutcome(
  previewCandidateCount: number,
  previews: DocumentPreviewItem[],
): PreviewAnalyticsOutcome {
  if (previewCandidateCount === 0) return 'skipped';
  if (previews.length === 0) return 'failed';
  if (previews.every((preview) => preview.previewUnavailable)) return 'failed';
  return 'completed';
}

export function previewFailureReason(
  previewCandidateCount: number,
  previews: DocumentPreviewItem[],
): string {
  if (previewCandidateCount === 0) return 'no_candidates';
  if (previews.length === 0) return 'no_previews_generated';
  if (previews.every((preview) => preview.previewUnavailable)) return 'all_unavailable';
  return 'partial_failure';
}

export function summarizeExtractedMetadata(extracted: ExtractedMetadata): {
  authorCount: number;
  affiliationCount: number;
  hasTitle: boolean;
  hasDoi: boolean;
} {
  return {
    authorCount: extracted.authors?.length ?? 0,
    affiliationCount: extracted.affiliations?.length ?? 0,
    hasTitle: Boolean(extracted.title?.trim()),
    hasDoi: Boolean(extracted.doi?.trim()),
  };
}

export function summarizePreviewFile(preview: DocumentPreviewItem | undefined): {
  fileType?: string;
  fileSizeBytes?: number;
} {
  if (!preview) return {};
  return {
    fileType: preview.data.type,
    fileSizeBytes: typeof preview.data.size === 'number' ? preview.data.size : undefined,
  };
}

type UploadFlowTrackContext = Pick<Context, 'trackEvent' | 'analytics' | 'request'>;

export async function trackUploadFlowEvent(
  ctx: UploadFlowTrackContext,
  event: TrackEvent,
  properties: Record<string, unknown>,
): Promise<void> {
  if (typeof ctx.trackEvent !== 'function') return;

  let path: string | undefined;
  try {
    path = new URL(ctx.request.url).pathname;
  } catch {
    path = undefined;
  }

  await ctx.trackEvent(
    event,
    path ? { ...properties, path } : properties,
    { ignoreAdmin: true },
  );
  if (typeof ctx.analytics?.flush === 'function') {
    await ctx.analytics.flush();
  }
}

export async function trackDocumentPreviewStarted(
  ctx: UploadFlowTrackContext,
  args: {
    workId: string;
    workVersionId: string;
    uploadFlowTrigger: UploadFlowTrigger;
    previewCandidateCount: number;
    fileTypes: string[];
    totalFileSizeBytes: number;
  },
): Promise<void> {
  await trackUploadFlowEvent(ctx, TrackEvent.DOCUMENT_PREVIEW_STARTED, {
    workId: args.workId,
    workVersionId: args.workVersionId,
    uploadFlowTrigger: args.uploadFlowTrigger,
    previewCandidateCount: args.previewCandidateCount,
    fileTypes: args.fileTypes,
    totalFileSizeBytes: args.totalFileSizeBytes,
  });
}

export async function trackDocumentPreviewAnalytics(
  ctx: UploadFlowTrackContext,
  args: {
    workId: string;
    workVersionId: string;
    uploadFlowTrigger: UploadFlowTrigger;
    previewCandidateCount: number;
    fileTypes: string[];
    totalFileSizeBytes: number;
    previews: DocumentPreviewItem[];
    failureReason?: string;
  },
): Promise<void> {
  const outcome = classifyPreviewOutcome(args.previewCandidateCount, args.previews);
  if (outcome === 'skipped') return;

  const event =
    outcome === 'completed'
      ? TrackEvent.DOCUMENT_PREVIEW_COMPLETED
      : TrackEvent.DOCUMENT_PREVIEW_FAILED;

  const previewSummary = summarizePreviewResults(args.previews, args.previewCandidateCount);
  const extractedImageCount =
    outcome === 'completed' ? extractedImageCountWhenAvailable(args.previews) : undefined;

  await trackUploadFlowEvent(ctx, event, {
    workId: args.workId,
    workVersionId: args.workVersionId,
    uploadFlowTrigger: args.uploadFlowTrigger,
    fileTypes: args.fileTypes,
    totalFileSizeBytes: args.totalFileSizeBytes,
    ...previewSummary,
    ...(extractedImageCount !== undefined ? { extractedImageCount } : {}),
    ...(outcome === 'failed'
      ? {
          failureReason:
            args.failureReason ??
            previewFailureReason(args.previewCandidateCount, args.previews),
        }
      : {}),
  });
}

export async function trackMetadataExtractionStarted(
  ctx: UploadFlowTrackContext,
  args: {
    workId: string;
    workVersionId: string;
    uploadFlowTrigger: UploadFlowTrigger;
    forceReextract: boolean;
    previewCount: number;
    selectedPreview?: DocumentPreviewItem;
  },
): Promise<void> {
  await trackUploadFlowEvent(ctx, TrackEvent.METADATA_EXTRACTION_STARTED, {
    workId: args.workId,
    workVersionId: args.workVersionId,
    uploadFlowTrigger: args.uploadFlowTrigger,
    forceReextract: args.forceReextract,
    previewCount: args.previewCount,
    ...summarizePreviewFile(args.selectedPreview),
  });
}

export async function trackMetadataExtractionAnalytics(
  ctx: UploadFlowTrackContext,
  args: {
    workId: string;
    workVersionId: string;
    success: boolean;
    uploadFlowTrigger: UploadFlowTrigger;
    forceReextract: boolean;
    previewCount: number;
    selectedPreview?: DocumentPreviewItem;
    extracted?: ExtractedMetadata | null;
    failureReason?: string;
  },
): Promise<void> {
  const event = args.success
    ? TrackEvent.METADATA_EXTRACTION_COMPLETED
    : TrackEvent.METADATA_EXTRACTION_FAILED;

  const payload: Record<string, unknown> = {
    workId: args.workId,
    workVersionId: args.workVersionId,
    uploadFlowTrigger: args.uploadFlowTrigger,
    forceReextract: args.forceReextract,
    previewCount: args.previewCount,
    ...summarizePreviewFile(args.selectedPreview),
  };

  if (args.success && args.extracted) {
    Object.assign(payload, summarizeExtractedMetadata(args.extracted));
  } else if (args.failureReason) {
    payload.failureReason = args.failureReason;
  }

  await trackUploadFlowEvent(ctx, event, payload);
}
