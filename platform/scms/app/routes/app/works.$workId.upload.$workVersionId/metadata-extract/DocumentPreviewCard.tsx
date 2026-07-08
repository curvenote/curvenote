import { AlertTriangle, FileText, RotateCcw, Search } from 'lucide-react';
import { LoadingSpinner } from '@curvenote/scms-core';
import { DocumentPreviewer, PREVIEW_SURFACE_CLASS } from './DocumentPreviewer';
import type { DocumentPreviewItem } from './fetchPreviews.server';
import { useDelayedFlag } from './useDelayedFlag';

/** Reveal the "skip the preview" escape hatch after this long in the busy state. */
const PREVIEW_SKIP_HATCH_DELAY_MS = 20000;

export interface DocumentPreviewCardProps {
  previews: DocumentPreviewItem[];
  isPreviewsLoading: boolean;
  previewOverlayMessage: string;
  /** Message describing why previews could not be generated; renders the error state. */
  previewError?: string | null;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  /**
   * When provided, a long-running busy state (>20s) reveals an escape hatch that
   * calls this to abandon preview generation and let the user proceed manually.
   */
  onSkipPreview?: () => void;
  /** True when the user skipped preview generation; renders the skipped state. */
  wasSkipped?: boolean;
  /** Restart preview generation from the skipped state. */
  onRetryPreview?: () => void;
}

const STATE_WRAPPER_CLASS =
  'flex min-h-[280px] w-full flex-col items-center justify-center gap-3 text-center';

function SkipPreviewHatch({ onSkip }: { onSkip: () => void }) {
  return (
    <p className="max-w-sm text-xs text-stone-500">
      Large documents may take longer to unpack. If this is taking too long you can{' '}
      <button
        type="button"
        onClick={onSkip}
        className="font-medium text-primary underline underline-offset-2 hover:no-underline"
      >
        skip the preview
      </button>{' '}
      and proceed manually.
    </p>
  );
}

function PreviewEmptyState() {
  return (
    <div className={STATE_WRAPPER_CLASS}>
      <div className="relative flex items-center justify-center text-stone-400">
        <FileText className="h-14 w-14" strokeWidth={1.25} />
        <Search className="absolute -bottom-1 -right-1 h-6 w-6 opacity-80" strokeWidth={2} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-stone-600">No preview yet</p>
        <p className="text-sm text-stone-500">
          Upload a manuscript file to see a preview of its contents here.
        </p>
      </div>
    </div>
  );
}

function PreviewSkippedState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className={STATE_WRAPPER_CLASS}>
      <div className="relative flex items-center justify-center text-stone-400">
        <FileText className="h-14 w-14" strokeWidth={1.25} />
        <RotateCcw className="absolute -bottom-1 -right-1 h-6 w-6 opacity-80" strokeWidth={2} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-stone-600">Preview skipped</p>
        <p className="max-w-sm text-sm text-stone-500">
          Enter the details manually below
          {onRetry ? (
            <>
              , or{' '}
              <button
                type="button"
                onClick={onRetry}
                className="font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                retry preview
              </button>
            </>
          ) : null}
          .
        </p>
      </div>
    </div>
  );
}

function PreviewBusyState({
  message,
  showSkipHatch,
  onSkipPreview,
}: {
  message: string;
  showSkipHatch: boolean;
  onSkipPreview?: () => void;
}) {
  return (
    <div className={STATE_WRAPPER_CLASS} aria-busy="true" aria-live="polite">
      <LoadingSpinner size={32} />
      <p className="text-sm text-stone-500">{message}</p>
      {showSkipHatch && onSkipPreview ? <SkipPreviewHatch onSkip={onSkipPreview} /> : null}
    </div>
  );
}

function PreviewErrorState({ message }: { message: string }) {
  return (
    <div className={STATE_WRAPPER_CLASS} role="alert">
      <AlertTriangle className="h-12 w-12 text-amber-500" strokeWidth={1.5} />
      <div className="space-y-1">
        <p className="text-sm font-medium text-stone-700">Preview unavailable</p>
        <p className="text-sm text-stone-500">{message}</p>
      </div>
    </div>
  );
}

export function DocumentPreviewCard({
  previews,
  isPreviewsLoading,
  previewOverlayMessage,
  previewError,
  activeTab,
  onActiveTabChange,
  onSkipPreview,
  wasSkipped = false,
  onRetryPreview,
}: DocumentPreviewCardProps) {
  const hasPreviews = previews.length > 0;
  // Only reveal the escape hatch during the initial unpack (no previews yet);
  // an overlay refresh over existing previews is not worth abandoning.
  const showSkipHatch = useDelayedFlag(
    isPreviewsLoading && !hasPreviews,
    PREVIEW_SKIP_HATCH_DELAY_MS,
  );

  // Empty / busy / error states share the same "paper" surface that tab content
  // uses, so the region reads consistently before any previews are available.
  if (!hasPreviews) {
    return (
      <div className={PREVIEW_SURFACE_CLASS}>
        {isPreviewsLoading ? (
          <PreviewBusyState
            message={previewOverlayMessage}
            showSkipHatch={showSkipHatch}
            onSkipPreview={onSkipPreview}
          />
        ) : wasSkipped ? (
          <PreviewSkippedState onRetry={onRetryPreview} />
        ) : previewError ? (
          <PreviewErrorState message={previewError} />
        ) : (
          <PreviewEmptyState />
        )}
      </div>
    );
  }

  // Previews exist: tabs sit on the page surface, tab content is bounded in a
  // card by DocumentPreviewer. A refresh overlays the whole region.
  return (
    <div className="relative">
      {isPreviewsLoading && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/80 backdrop-blur-[1px]"
          aria-busy="true"
          aria-live="polite"
        >
          <LoadingSpinner size={32} />
          <p className="text-sm text-muted-foreground">{previewOverlayMessage}</p>
        </div>
      )}
      <DocumentPreviewer
        previews={previews}
        activeTab={activeTab}
        onActiveTabChange={onActiveTabChange}
      />
    </div>
  );
}
