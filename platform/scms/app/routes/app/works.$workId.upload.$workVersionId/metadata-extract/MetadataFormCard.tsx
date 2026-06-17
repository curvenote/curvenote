import { Bot, RefreshCw } from 'lucide-react';
import { ui, LoadingSpinner } from '@curvenote/scms-core';
import type { ExtractedMetadata } from './anthropic.server';
import { WorkTitleForm } from '../WorkTitleForm';
import { AuthorsForm } from '../AuthorsForm';

function authorsFromExtracted(extracted: ExtractedMetadata | null): string {
  if (!extracted?.authors?.length) return '';
  return extracted.authors
    .map((a) => (typeof a.name === 'string' ? a.name : ''))
    .filter(Boolean)
    .join(', ');
}

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
  authors: string;
  /** Name of the file the re-run control targets; hides the control when undefined. */
  reRunFileName?: string;
  onReRunExtraction?: () => void;
}

export function MetadataFormCard({
  extractedMetadata,
  isExtractingMetadata,
  title,
  authors,
  reRunFileName,
  onReRunExtraction,
}: MetadataFormCardProps) {
  const displayTitle = (title?.trim() ? title : extractedMetadata?.title) ?? '';
  const initialAuthors = authors?.trim() ? authors : authorsFromExtracted(extractedMetadata);

  return (
    <ui.Card className="relative px-6 pt-4 pb-6 space-y-4 h-fit min-w-lg">
      {isExtractingMetadata && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-md bg-background/80 backdrop-blur-[1px]"
          aria-busy="true"
          aria-live="polite"
        >
          <LoadingSpinner size={32} />
          <p className="text-sm text-muted-foreground">Extracting metadata…</p>
        </div>
      )}
      <div className="flex gap-2 items-center">
        <Bot className="w-5 h-5 text-muted-foreground" />
        <h3 className="text-base font-semibold">Work Details</h3>
      </div>
      <WorkTitleForm title={displayTitle} />
      <AuthorsForm initialAuthors={initialAuthors} />
      {extractedMetadata != null && (
        <details className="mt-4">
          <summary className="text-sm font-medium cursor-pointer">All metadata</summary>
          <pre className="overflow-auto p-3 mt-2 max-h-48 text-xs rounded bg-muted">
            {JSON.stringify(extractedMetadata, null, 2)}
          </pre>
        </details>
      )}
      {reRunFileName && onReRunExtraction ? (
        <div className="flex justify-end">
          <ui.Button
            type="button"
            variant="link"
            size="sm"
            className="p-0 h-auto"
            onClick={onReRunExtraction}
            disabled={isExtractingMetadata}
            title={`Re-run extraction on ${reRunFileName}`}
          >
            <RefreshCw className="mr-1.5 w-3.5 h-3.5" />
            {`re-run extraction on ${shortenFileName(reRunFileName)}`}
          </ui.Button>
        </div>
      ) : null}
    </ui.Card>
  );
}
