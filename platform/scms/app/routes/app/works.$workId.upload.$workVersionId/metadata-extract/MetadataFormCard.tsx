import { RefreshCw, X } from 'lucide-react';
import { ui, LoadingSpinner } from '@curvenote/scms-core';
import type { ExtractedMetadata } from './anthropic.server';
import { WorkTitleForm } from '../WorkTitleForm';
import { AuthorMetadataForm } from '../AuthorMetadataForm';
import type { AuthorFieldMetadata } from '../mystAuthorAdapters';

/** Shorten a file name for the re-run label. */
function shortenFileName(name: string, max = 32): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1).trimEnd()}…`;
}

export interface MetadataFormCardProps {
  extractedMetadata: ExtractedMetadata | null;
  /** True while an extraction request is in flight (drives the overlay). */
  isExtractingMetadata: boolean;
  extractingMetadataMessage?: string;
  title: string;
  authorMetadata: AuthorFieldMetadata;
  onAuthorMetadataChange: (value: AuthorFieldMetadata) => void;
  /** Name of the file the re-run control targets; hides the control when undefined. */
  reRunFileName?: string;
  /** Number of previewable files; when 1, the re-run label omits the file name. */
  previewFileCount?: number;
  onReRunExtraction?: () => void;
  onClearExtraction?: () => void;
  isClearingExtraction?: boolean;
}

export function MetadataFormCard({
  extractedMetadata,
  isExtractingMetadata,
  extractingMetadataMessage = 'Waiting for document to unpack...',
  title,
  authorMetadata,
  onAuthorMetadataChange,
  reRunFileName,
  previewFileCount = 0,
  onReRunExtraction,
  onClearExtraction,
  isClearingExtraction = false,
}: MetadataFormCardProps) {
  const displayTitle = (title?.trim() ? title : extractedMetadata?.title) ?? '';
  const canReRunExtraction = Boolean(reRunFileName) && onReRunExtraction != null;
  const canClearExtraction = extractedMetadata != null && onClearExtraction != null;
  const hasControls = canReRunExtraction || canClearExtraction;
  const reRunLabel =
    previewFileCount <= 1 ? 're-run extraction' : `re-run on ${shortenFileName(reRunFileName!)}`;
  const reRunTitle =
    previewFileCount <= 1 ? 'Re-run extraction' : `Re-run extraction on ${reRunFileName}`;

  const controlsRow = hasControls ? (
    <div className="flex gap-3 justify-end items-center">
      {canReRunExtraction ? (
        <ui.Button
          type="button"
          variant="link"
          size="sm"
          className="p-0 h-auto text-xs"
          onClick={onReRunExtraction}
          disabled={isExtractingMetadata || isClearingExtraction}
          title={reRunTitle}
        >
          <RefreshCw className="mr-px w-3.5 h-3.5" />
          {reRunLabel}
        </ui.Button>
      ) : null}
      {canClearExtraction ? (
        <ui.Button
          type="button"
          variant="link"
          size="sm"
          className="p-0 h-auto text-xs"
          onClick={onClearExtraction}
          disabled={isExtractingMetadata || isClearingExtraction}
          title="Clear extracted metadata"
        >
          <X className="mr-px w-3.5 h-3.5" />
          {isClearingExtraction ? 'clearing...' : 'clear'}
        </ui.Button>
      ) : null}
    </div>
  ) : null;

  return (
    <ui.Card className="relative px-6 pt-4 pb-6 space-y-4 h-fit max-w-3xl">
      {isExtractingMetadata && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-md bg-background/80 backdrop-blur-[1px]"
          aria-busy="true"
          aria-live="polite"
        >
          <LoadingSpinner size={32} />
          <p className="text-sm text-muted-foreground">{extractingMetadataMessage}</p>
        </div>
      )}
      {controlsRow}
      <WorkTitleForm title={displayTitle} />
      <AuthorMetadataForm value={authorMetadata} onChange={onAuthorMetadataChange} />
      {controlsRow}
    </ui.Card>
  );
}
