import { AlertTriangle, FileText, Search } from 'lucide-react';
import { LoadingSpinner } from '@curvenote/scms-core';
import { DocumentPreviewer, PREVIEW_SURFACE_CLASS } from './DocumentPreviewer';
import type { DocumentPreviewItem } from './fetchPreviews.server';

export interface DocumentPreviewCardProps {
  previews: DocumentPreviewItem[];
  isPreviewsLoading: boolean;
  previewOverlayMessage: string;
  /** Message describing why previews could not be generated; renders the error state. */
  previewError?: string | null;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
}

const STATE_WRAPPER_CLASS =
  'flex min-h-[280px] w-full flex-col items-center justify-center gap-3 text-center';

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

function PreviewBusyState({ message }: { message: string }) {
  return (
    <div className={STATE_WRAPPER_CLASS} aria-busy="true" aria-live="polite">
      <LoadingSpinner size={32} />
      <p className="text-sm text-stone-500">{message}</p>
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
}: DocumentPreviewCardProps) {
  const hasPreviews = previews.length > 0;

  // Empty / busy / error states share the same "paper" surface that tab content
  // uses, so the region reads consistently before any previews are available.
  if (!hasPreviews) {
    return (
      <div className={PREVIEW_SURFACE_CLASS}>
        {isPreviewsLoading ? (
          <PreviewBusyState message={previewOverlayMessage} />
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
