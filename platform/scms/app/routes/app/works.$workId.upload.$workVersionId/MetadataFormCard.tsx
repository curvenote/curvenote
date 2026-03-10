import { useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';
import { ui, LoadingSpinner } from '@curvenote/scms-core';
import type { Route } from './+types/route';
import type { ExtractedMetadata } from './anthropic.server';
import { WorkTitleForm } from './WorkTitleForm';
import { AuthorsForm } from './AuthorsForm';

function authorsFromExtracted(extracted: ExtractedMetadata | null): string {
  if (!extracted?.authors?.length) return '';
  return extracted.authors
    .map((a) => (typeof a.name === 'string' ? a.name : ''))
    .filter(Boolean)
    .join(', ');
}

export interface MetadataFormCardProps {
  extractedMetadata: ExtractedMetadata | null;
  title: string;
  authors: string;
  /** True when there is at least one DOCX preview (enables extract-metadata trigger) */
  hasPreviews: boolean;
}

export function MetadataFormCard({
  extractedMetadata,
  title,
  authors,
  hasPreviews,
}: MetadataFormCardProps) {
  const extractMetadataFetcher = useFetcher<Route.ComponentProps['actionData']>();
  const hasTriggeredExtractMetadata = useRef(false);

  const shouldExtractMetadata =
    !extractedMetadata && hasPreviews && extractMetadataFetcher.state === 'idle';

  useEffect(() => {
    if (!shouldExtractMetadata) {
      if (extractedMetadata) hasTriggeredExtractMetadata.current = false;
      return;
    }
    if (hasTriggeredExtractMetadata.current || extractMetadataFetcher.state !== 'idle') return;
    hasTriggeredExtractMetadata.current = true;
    extractMetadataFetcher.submit({ intent: 'extract-metadata' }, { method: 'POST' });
  }, [
    shouldExtractMetadata,
    extractedMetadata,
    extractMetadataFetcher.state,
    extractMetadataFetcher,
  ]);

  useEffect(() => {
    const data = extractMetadataFetcher.data as { error: { message: string } } | undefined;
    if (extractMetadataFetcher.state === 'idle' && data?.error) {
      ui.toastError(data.error.message);
    }
  }, [extractMetadataFetcher.state, extractMetadataFetcher.data]);

  const isExtractingMetadata =
    extractMetadataFetcher.state === 'loading' || extractMetadataFetcher.state === 'submitting';

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
    </ui.Card>
  );
}
