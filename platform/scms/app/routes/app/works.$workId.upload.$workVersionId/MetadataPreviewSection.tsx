import { Eye } from 'lucide-react';
import { SectionWithHeading, ui, LoadingSpinner } from '@curvenote/scms-core';
import { DocxPreviewer } from './DocxPreviewer';
import { MetadataFormCard } from './MetadataFormCard';
import type { DocxPreviewItem } from './fetchPreviews.server';
import type { ExtractedMetadata } from './anthropic.server';

export interface MetadataPreviewSectionProps {
  previewList: DocxPreviewItem[];
  isPreviewsLoading: boolean;
  previewOverlayMessage: string;
  extractedMetadata: ExtractedMetadata | null;
  title: string;
  authors: string;
}

export function MetadataPreviewSection({
  previewList,
  isPreviewsLoading,
  previewOverlayMessage,
  extractedMetadata,
  title,
  authors,
}: MetadataPreviewSectionProps) {
  return (
    <SectionWithHeading
      heading="Metadata Preview"
      icon={<Eye className="w-5 h-5" />}
      className="space-y-4"
    >
      <p className="text-muted-foreground">Review your document metadata</p>
      <div
        className={
          previewList.length > 0
            ? 'grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr] lg:items-stretch'
            : 'flex gap-6 max-w-5xl'
        }
      >
        <ui.Card
          className={
            previewList.length > 0
              ? 'overflow-hidden p-0 min-h-0 flex flex-col'
              : 'overflow-hidden p-0 min-h-0 flex flex-col max-w-xl'
          }
        >
          <div className="min-h-[200px] flex-1 flex flex-col p-4 relative">
            {isPreviewsLoading && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-md bg-background/80 backdrop-blur-[1px]"
                aria-busy="true"
                aria-live="polite"
              >
                <LoadingSpinner size={32} />
                <p className="text-sm text-muted-foreground">{previewOverlayMessage}</p>
              </div>
            )}
            <DocxPreviewer previews={previewList} />
          </div>
        </ui.Card>
        <MetadataFormCard
          extractedMetadata={extractedMetadata}
          title={title}
          authors={authors}
          hasPreviews={previewList.length > 0}
        />
      </div>
    </SectionWithHeading>
  );
}
