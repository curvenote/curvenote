import { Bot, RefreshCw, X } from 'lucide-react';
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
  title: string;
  authorMetadata: AuthorFieldMetadata;
  onAuthorMetadataChange: (value: AuthorFieldMetadata) => void;
  /** Name of the file the re-run control targets; hides the control when undefined. */
  reRunFileName?: string;
  onReRunExtraction?: () => void;
  onClearExtraction?: () => void;
  isClearingExtraction?: boolean;
}

export function MetadataFormCard({
  extractedMetadata,
  isExtractingMetadata,
  title,
  authorMetadata,
  onAuthorMetadataChange,
  reRunFileName,
  onReRunExtraction,
  onClearExtraction,
  isClearingExtraction = false,
}: MetadataFormCardProps) {
  const displayTitle = (title?.trim() ? title : extractedMetadata?.title) ?? '';
  const canClearExtraction = extractedMetadata != null && onClearExtraction != null;

  return (
    <ui.Card className="relative px-6 pt-4 pb-6 space-y-4 h-fit min-w-lg">
      {isExtractingMetadata && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-md bg-background/80 backdrop-blur-[1px]"
          aria-busy="true"
          aria-live="polite"
        >
          <LoadingSpinner size={32} />
          <p className="text-sm text-muted-foreground">waiting on extraction</p>
        </div>
      )}
      {(canClearExtraction || (reRunFileName && onReRunExtraction)) && (
        <div className="flex gap-3 justify-between items-center min-h-5">
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
              <X className="mr-0.5 w-3.5 h-3.5" />
              {isClearingExtraction ? 'clearing...' : 'clear'}
            </ui.Button>
          ) : (
            <span aria-hidden />
          )}
          {reRunFileName && onReRunExtraction ? (
            <ui.Button
              type="button"
              variant="link"
              size="sm"
              className="p-0 h-auto text-xs"
              onClick={onReRunExtraction}
              disabled={isExtractingMetadata || isClearingExtraction}
              title={`Re-run extraction on ${reRunFileName}`}
            >
              <RefreshCw className="mr-1.5 w-3.5 h-3.5" />
              {`re-run on ${shortenFileName(reRunFileName)}`}
            </ui.Button>
          ) : null}
        </div>
      )}
      <div className="flex gap-2 items-center">
        <Bot className="w-5 h-5 text-muted-foreground" />
        <h3 className="text-base font-semibold">Work Details</h3>
      </div>
      <WorkTitleForm title={displayTitle} />
      <AuthorMetadataForm value={authorMetadata} onChange={onAuthorMetadataChange} />
    </ui.Card>
  );
}
