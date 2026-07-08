import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { Eye, List } from 'lucide-react';
import { SectionWithHeading, ui } from '@curvenote/scms-core';
import type { Route } from '../+types/route';
import { ALL_FIGURES_TAB } from './DocumentPreviewer';
import { DocumentPreviewCard } from './DocumentPreviewCard';
import { MetadataFormCard } from './MetadataFormCard';
import type { DocumentPreviewItem } from './fetchPreviews.server';
import type { ExtractedMetadata } from './anthropic.server';
import type { AuthorFieldMetadata } from '../mystAuthorAdapters';

const EMPTY_AUTHOR_METADATA: AuthorFieldMetadata = { authors: [], affiliations: [] };
const WAITING_FOR_UNPACK_MESSAGE = 'Waiting for document to unpack...';
const EXTRACTING_WORK_DETAILS_MESSAGE = 'Extracting work details...';
const FINALIZING_EXTRACTION_MESSAGE = 'Finalizing...';

export interface MetadataExtractSectionProps {
  previewList: DocumentPreviewItem[];
  isPreviewsLoading: boolean;
  previewOverlayMessage: string;
  /** Message describing why previews could not be generated; renders the error state. */
  previewError?: string | null;
  extractedMetadata: ExtractedMetadata | null;
  title: string;
  authorMetadata: AuthorFieldMetadata;
  onAuthorMetadataChange: (value: AuthorFieldMetadata) => void;
  /**
   * Number of previewable manuscript files currently in the upload area. Drops to
   * 0 as soon as the user removes the last document, which stops any in-flight
   * preview/extraction busy state immediately.
   */
  manuscriptFileCount: number;
  /** Restart preview generation after the user skipped it. */
  onRetryPreview?: () => void;
}

export function MetadataExtractSection({
  previewList,
  isPreviewsLoading,
  previewOverlayMessage,
  previewError,
  extractedMetadata,
  title,
  authorMetadata,
  onAuthorMetadataChange,
  manuscriptFileCount,
  onRetryPreview,
}: MetadataExtractSectionProps) {
  const extractMetadataFetcher = useFetcher<Route.ComponentProps['actionData']>();
  const clearMetadataFetcher = useFetcher<Route.ComponentProps['actionData']>();
  const hasTriggeredExtractMetadata = useRef(false);
  const [activeTab, setActiveTab] = useState('0');
  const [hasLocallyClearedExtraction, setHasLocallyClearedExtraction] = useState(false);
  // Tracks a bridged busy state for auto-extraction: true from the moment a fresh
  // upload starts unpacking until the AI extraction request resolves.
  const [isAutoExtractPending, setIsAutoExtractPending] = useState(false);
  // Escape-hatch state: the user chose to abandon a slow preview generation or a
  // slow AI extraction and proceed manually. Both suppress their busy overlay and
  // prevent the (follow-on) auto-extraction from firing for the current attempt.
  const [hasSkippedPreview, setHasSkippedPreview] = useState(false);
  const [hasSkippedExtraction, setHasSkippedExtraction] = useState(false);

  // A fresh preview generation (idle→loading) clears any prior skip so a new
  // upload gets the normal preview + auto-extract flow again.
  const prevIsPreviewsLoadingRef = useRef(isPreviewsLoading);
  useEffect(() => {
    const wasLoading = prevIsPreviewsLoadingRef.current;
    prevIsPreviewsLoadingRef.current = isPreviewsLoading;
    if (!wasLoading && isPreviewsLoading) {
      setHasSkippedPreview(false);
      setHasSkippedExtraction(false);
    }
  }, [isPreviewsLoading]);

  // Removing the last document from the upload area is an immediate stop signal:
  // there is nothing left to unpack or extract, so both busy states must clear
  // even while their server requests are still in flight (and cannot be aborted).
  const hasManuscriptFiles = manuscriptFileCount > 0;
  useEffect(() => {
    if (!hasManuscriptFiles) {
      setIsAutoExtractPending(false);
      hasTriggeredExtractMetadata.current = false;
    }
  }, [hasManuscriptFiles]);

  const effectiveIsPreviewsLoading = isPreviewsLoading && !hasSkippedPreview && hasManuscriptFiles;

  const hasPreviews = previewList.length > 0;
  const previewSourceKey = previewList.map((preview) => preview.path).join('|');
  const prevPreviewPathsRef = useRef<string[]>(previewList.map((preview) => preview.path));

  // Keep the active file tab valid as the preview list changes. Tabs are keyed by
  // positional index, so a removed/reordered file would otherwise leave the preview
  // on a stale index (or a different file). Track the active file by path: if it was
  // removed, fall through to the next available file at that position; if it merely
  // shifted, follow it to its new index.
  useEffect(() => {
    const prevPaths = prevPreviewPathsRef.current;
    const nextPaths = previewList.map((preview) => preview.path);
    prevPreviewPathsRef.current = nextPaths;

    if (activeTab === ALL_FIGURES_TAB) return;
    const currentIndex = Number(activeTab);
    if (!Number.isInteger(currentIndex)) return;

    const activePath = prevPaths[currentIndex];
    if (activePath == null) {
      if (nextPaths.length > 0 && currentIndex > nextPaths.length - 1) {
        setActiveTab(String(nextPaths.length - 1));
      }
      return;
    }

    const nextIndex = nextPaths.indexOf(activePath);
    if (nextIndex === -1) {
      if (nextPaths.length > 0) {
        setActiveTab(String(Math.min(currentIndex, nextPaths.length - 1)));
      }
    } else if (nextIndex !== currentIndex) {
      setActiveTab(String(nextIndex));
    }
  }, [previewSourceKey, previewList, activeTab]);
  const visibleExtractedMetadata = hasLocallyClearedExtraction ? null : extractedMetadata;
  const visibleTitle = hasLocallyClearedExtraction ? '' : title;
  const visibleAuthorMetadata = hasLocallyClearedExtraction
    ? EMPTY_AUTHOR_METADATA
    : authorMetadata;
  // Auto-extraction only fires when the manuscript file set transitions from empty
  // to non-empty (the first upload, or a fresh upload after every file was removed)
  // AND the user has not already provided a title or authors. Adding/replacing files
  // when metadata already exists, page reloads, or clearing extracted metadata do NOT
  // re-trigger extraction — that is left to the user via the manual re-extract action.
  // Use the locally-cleared (visible) values so a fresh upload right after clearing
  // still counts as empty even before the clear action revalidates the loader props.
  const metadataIsEmpty =
    !visibleTitle?.trim() && (visibleAuthorMetadata.authors?.length ?? 0) === 0;
  const prevFileCountRef = useRef(previewList.length);

  useEffect(() => {
    const prevCount = prevFileCountRef.current;
    const currentCount = previewList.length;

    if (currentCount === 0) {
      // No files: allow a future upload to auto-extract again. While a brand-new
      // upload is unpacking (previously empty, metadata empty), keep the card busy so
      // it bridges continuously from unpacking into the AI extraction — unless the
      // user skipped the preview, in which case we drop straight to manual entry.
      hasTriggeredExtractMetadata.current = false;
      if (prevCount === 0 && effectiveIsPreviewsLoading && metadataIsEmpty) {
        setIsAutoExtractPending(true);
      } else if (!effectiveIsPreviewsLoading) {
        setIsAutoExtractPending(false);
      }
      prevFileCountRef.current = currentCount;
      return;
    }

    // Files just arrived from an empty set: this is a first/fresh upload.
    if (prevCount === 0) {
      // A skipped preview or skipped extraction opts out of the follow-on auto call.
      if (
        metadataIsEmpty &&
        !hasTriggeredExtractMetadata.current &&
        !hasSkippedPreview &&
        !hasSkippedExtraction
      ) {
        if (extractMetadataFetcher.state === 'idle') {
          hasTriggeredExtractMetadata.current = true;
          setIsAutoExtractPending(true);
          extractMetadataFetcher.submit({ intent: 'extract-metadata' }, { method: 'POST' });
          prevFileCountRef.current = currentCount;
        }
        // Fetcher busy: keep ref at 0 so we retry when it becomes idle.
      } else if (!metadataIsEmpty || hasSkippedPreview || hasSkippedExtraction) {
        setIsAutoExtractPending(false);
        prevFileCountRef.current = currentCount;
      }
      return;
    }

    prevFileCountRef.current = currentCount;
  }, [
    previewSourceKey,
    effectiveIsPreviewsLoading,
    metadataIsEmpty,
    hasSkippedPreview,
    hasSkippedExtraction,
    extractMetadataFetcher.state,
    extractMetadataFetcher,
  ]);

  // Drop the bridged busy state once an extraction request has actually completed.
  const autoExtractInFlightRef = useRef(false);
  useEffect(() => {
    const inFlight =
      extractMetadataFetcher.state === 'loading' || extractMetadataFetcher.state === 'submitting';
    if (inFlight) {
      autoExtractInFlightRef.current = true;
    } else if (autoExtractInFlightRef.current) {
      autoExtractInFlightRef.current = false;
      setIsAutoExtractPending(false);
    }
  }, [extractMetadataFetcher.state]);

  useEffect(() => {
    const result = extractMetadataFetcher.data as { error?: { message: string } } | undefined;
    if (extractMetadataFetcher.state === 'idle' && result?.error) {
      ui.toastError(result.error.message);
    }
  }, [extractMetadataFetcher.state, extractMetadataFetcher.data]);

  useEffect(() => {
    const result = clearMetadataFetcher.data as { error?: { message: string } } | undefined;
    if (clearMetadataFetcher.state === 'idle' && result?.error) {
      ui.toastError(result.error.message);
    }
  }, [clearMetadataFetcher.state, clearMetadataFetcher.data]);

  const isExtractionInFlight =
    extractMetadataFetcher.state === 'loading' || extractMetadataFetcher.state === 'submitting';
  // `isAutoExtractPending` bridges the busy state from the moment a fresh upload starts
  // unpacking until the AI request resolves, so the metadata card stays busy continuously
  // and avoids an idle flash between previews finishing and extraction starting.
  // Skipping extraction drops the overlay immediately so the user can type, as does
  // removing the manuscript file(s) that were being extracted.
  const isExtractingMetadata =
    (isExtractionInFlight || isAutoExtractPending) && !hasSkippedExtraction && hasManuscriptFiles;
  const extractingMetadataMessage = (() => {
    if (extractMetadataFetcher.state === 'submitting') return EXTRACTING_WORK_DETAILS_MESSAGE;
    if (extractMetadataFetcher.state === 'loading') return FINALIZING_EXTRACTION_MESSAGE;
    if (hasTriggeredExtractMetadata.current) return FINALIZING_EXTRACTION_MESSAGE;
    return WAITING_FOR_UNPACK_MESSAGE;
  })();
  const isClearingExtraction =
    clearMetadataFetcher.state === 'loading' || clearMetadataFetcher.state === 'submitting';

  // Resolve the file backing the active tab; non-file tabs (e.g. All Figures)
  // fall back to the first file.
  const activeFile = (() => {
    if (!hasPreviews) return undefined;
    if (activeTab === ALL_FIGURES_TAB) return previewList[0];
    const index = Number(activeTab);
    return Number.isInteger(index) && index >= 0 && index < previewList.length
      ? previewList[index]
      : previewList[0];
  })();
  const activeFileName = activeFile?.data?.name ?? activeFile?.path ?? '';
  const activeFilePath = activeFile?.path;

  const handleReRunExtraction = () => {
    if (!activeFilePath) return;
    setHasLocallyClearedExtraction(false);
    // An explicit re-run overrides an earlier skip decision.
    setHasSkippedExtraction(false);
    extractMetadataFetcher.submit(
      { intent: 'extract-metadata', force: 'true', path: activeFilePath },
      { method: 'POST' },
    );
  };

  // Abandon a slow preview generation: hide the busy overlay and skip the
  // follow-on auto-extraction so the user can fill the form manually. The
  // in-flight server request cannot be aborted; late-arriving previews simply
  // render without re-triggering extraction.
  const handleSkipPreview = () => {
    setHasSkippedPreview(true);
    setIsAutoExtractPending(false);
  };

  // Abandon a slow AI extraction: hide the busy overlay for manual entry. The
  // in-flight request cannot be aborted, but the overlay clears immediately.
  const handleSkipExtraction = () => {
    setHasSkippedExtraction(true);
    setIsAutoExtractPending(false);
  };

  // Recover from a skipped preview: clear the skip and re-kick generation so the
  // busy state (and follow-on auto-extraction) resume as if it were never skipped.
  const handleRetryPreview = () => {
    setHasSkippedPreview(false);
    onRetryPreview?.();
  };

  const handleClearExtraction = () => {
    setHasLocallyClearedExtraction(true);
    onAuthorMetadataChange(EMPTY_AUTHOR_METADATA);
    clearMetadataFetcher.submit({ intent: 'clear-extracted-metadata' }, { method: 'POST' });
  };

  return (
    <div className="space-y-12">
      <SectionWithHeading
        heading="Unpacking your manuscript"
        icon={<Eye className="w-5 h-5" />}
        className="space-y-4"
      >
        <DocumentPreviewCard
          previews={previewList}
          isPreviewsLoading={effectiveIsPreviewsLoading}
          previewOverlayMessage={previewOverlayMessage}
          previewError={previewError}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          onSkipPreview={handleSkipPreview}
          wasSkipped={hasSkippedPreview && hasManuscriptFiles}
          onRetryPreview={handleRetryPreview}
        />
      </SectionWithHeading>
      <SectionWithHeading
        heading="Add Some Details About This Work"
        icon={<List className="w-5 h-5" />}
        className="space-y-4 max-w-3xl"
      >
        <p className="text-sm text-muted-foreground">
          Once you upload files, we will try to extract the title and author information
          automatically, if this is not possible please add it manually below. Note: only a title is
          strictly required.
        </p>
        <MetadataFormCard
          extractedMetadata={visibleExtractedMetadata}
          isExtractingMetadata={isExtractingMetadata}
          extractingMetadataMessage={extractingMetadataMessage}
          title={visibleTitle}
          authorMetadata={visibleAuthorMetadata}
          onAuthorMetadataChange={onAuthorMetadataChange}
          reRunFileName={activeFile && activeFilePath ? activeFileName : undefined}
          previewFileCount={previewList.length}
          onReRunExtraction={handleReRunExtraction}
          onClearExtraction={handleClearExtraction}
          isClearingExtraction={isClearingExtraction}
          onSkipExtraction={handleSkipExtraction}
          isPreviewBusy={effectiveIsPreviewsLoading}
        />
      </SectionWithHeading>
    </div>
  );
}
