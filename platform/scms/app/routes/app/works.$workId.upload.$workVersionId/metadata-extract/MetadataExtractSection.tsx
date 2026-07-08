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
  /** True when the cached extraction no longer matches the current manuscript file(s). */
  isExtractionStale: boolean;
  title: string;
  authorMetadata: AuthorFieldMetadata;
  onAuthorMetadataChange: (value: AuthorFieldMetadata) => void;
}

export function MetadataExtractSection({
  previewList,
  isPreviewsLoading,
  previewOverlayMessage,
  previewError,
  extractedMetadata,
  isExtractionStale,
  title,
  authorMetadata,
  onAuthorMetadataChange,
}: MetadataExtractSectionProps) {
  const extractMetadataFetcher = useFetcher<Route.ComponentProps['actionData']>();
  const clearMetadataFetcher = useFetcher<Route.ComponentProps['actionData']>();
  const hasTriggeredExtractMetadata = useRef(false);
  const [activeTab, setActiveTab] = useState('0');
  const [autoExtractionSuppressedFor, setAutoExtractionSuppressedFor] = useState<string | null>(
    null,
  );
  const [hasLocallyClearedExtraction, setHasLocallyClearedExtraction] = useState(false);

  const hasPreviews = previewList.length > 0;
  const previewSourceKey = previewList.map((preview) => preview.path).join('|');
  const visibleExtractedMetadata = hasLocallyClearedExtraction ? null : extractedMetadata;
  const visibleTitle = hasLocallyClearedExtraction ? '' : title;
  const visibleAuthorMetadata = hasLocallyClearedExtraction
    ? EMPTY_AUTHOR_METADATA
    : authorMetadata;
  // Extract when there is no cached metadata yet, or when the cache is stale
  // because the manuscript file(s) changed since the last extraction.
  const needsExtraction = !visibleExtractedMetadata || isExtractionStale;
  const shouldExtractMetadata =
    needsExtraction &&
    hasPreviews &&
    autoExtractionSuppressedFor !== previewSourceKey &&
    extractMetadataFetcher.state === 'idle';

  useEffect(() => {
    if (!shouldExtractMetadata) {
      if (!needsExtraction) hasTriggeredExtractMetadata.current = false;
      return;
    }
    if (hasTriggeredExtractMetadata.current || extractMetadataFetcher.state !== 'idle') return;
    hasTriggeredExtractMetadata.current = true;
    extractMetadataFetcher.submit({ intent: 'extract-metadata' }, { method: 'POST' });
  }, [
    shouldExtractMetadata,
    needsExtraction,
    autoExtractionSuppressedFor,
    previewSourceKey,
    extractMetadataFetcher.state,
    extractMetadataFetcher,
  ]);

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
  // Bridge the busy state across the whole "until results are in" window rather than only
  // while the AI request is in flight: show it while previews are still being generated
  // (extraction can't start yet) and while extraction is pending/about to fire. This keeps
  // the metadata card busy continuously from preview processing through the AI call,
  // avoiding an idle flash in the gap between previews finishing and extraction starting.
  const isAwaitingExtraction =
    needsExtraction &&
    autoExtractionSuppressedFor !== previewSourceKey &&
    (isPreviewsLoading || shouldExtractMetadata);
  const isExtractingMetadata = isExtractionInFlight || isAwaitingExtraction;
  const extractingMetadataMessage = (() => {
    if (extractMetadataFetcher.state === 'submitting') return EXTRACTING_WORK_DETAILS_MESSAGE;
    if (extractMetadataFetcher.state === 'loading') return FINALIZING_EXTRACTION_MESSAGE;
    if (hasTriggeredExtractMetadata.current && needsExtraction)
      return FINALIZING_EXTRACTION_MESSAGE;
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
    setAutoExtractionSuppressedFor(null);
    setHasLocallyClearedExtraction(false);
    extractMetadataFetcher.submit(
      { intent: 'extract-metadata', force: 'true', path: activeFilePath },
      { method: 'POST' },
    );
  };

  const handleClearExtraction = () => {
    setAutoExtractionSuppressedFor(previewSourceKey);
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
          isPreviewsLoading={isPreviewsLoading}
          previewOverlayMessage={previewOverlayMessage}
          previewError={previewError}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
        />
      </SectionWithHeading>
      <SectionWithHeading
        heading="Add Some Details About This Work"
        icon={<List className="w-5 h-5" />}
        className="space-y-4"
      >
        <MetadataFormCard
          extractedMetadata={visibleExtractedMetadata}
          isExtractingMetadata={isExtractingMetadata}
          extractingMetadataMessage={extractingMetadataMessage}
          title={visibleTitle}
          authorMetadata={visibleAuthorMetadata}
          onAuthorMetadataChange={onAuthorMetadataChange}
          reRunFileName={activeFile && activeFilePath ? activeFileName : undefined}
          onReRunExtraction={handleReRunExtraction}
          onClearExtraction={handleClearExtraction}
          isClearingExtraction={isClearingExtraction}
        />
      </SectionWithHeading>
    </div>
  );
}
