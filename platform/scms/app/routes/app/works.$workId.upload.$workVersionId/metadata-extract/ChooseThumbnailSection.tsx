import { useState } from 'react';
import { Image as ImageIcon, Check } from 'lucide-react';
import { SectionWithHeading, cn } from '@curvenote/scms-core';
import { collectAllFigures } from './DocxPreviewer';
import type { DocxPreviewItem } from './fetchPreviews.server';

export interface ChooseThumbnailSectionProps {
  previewList: DocxPreviewItem[];
}

export function ChooseThumbnailSection({ previewList }: ChooseThumbnailSectionProps) {
  const figures = collectAllFigures(previewList);
  // Default selection is the first figure in the list.
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (figures.length === 0) return null;

  return (
    <SectionWithHeading
      heading="Choose a Thumbnail"
      icon={<ImageIcon className="w-5 h-5" />}
      className="space-y-4 max-w-5xl"
    >
      <p className="text-muted-foreground">
        Select an image from your document to use as the thumbnail.
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {figures.map(({ attachment, sourceName }, index) => {
          const src = attachment.data
            ? `data:${attachment.mimeType};base64,${attachment.data}`
            : undefined;
          const isSelected = index === selectedIndex;
          return (
            <button
              type="button"
              key={`${sourceName}-${attachment.name}-${index}`}
              onClick={() => setSelectedIndex(index)}
              aria-pressed={isSelected}
              title={attachment.altText ?? attachment.name ?? 'Figure'}
              className={cn(
                'group relative flex flex-col gap-1 rounded-md border-2 p-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isSelected
                  ? 'border-primary'
                  : 'border-transparent hover:border-stone-300 dark:hover:border-stone-600',
              )}
            >
              <div className="flex overflow-hidden justify-center items-center min-h-0 rounded aspect-square bg-stone-100 dark:bg-stone-800">
                {src ? (
                  <img
                    src={src}
                    alt={attachment.altText ?? attachment.name ?? ''}
                    className="object-contain w-full h-full"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">[No data]</span>
                )}
              </div>
              <p
                className="text-xs truncate text-muted-foreground/80"
                title={attachment.altText ?? attachment.name}
              >
                {attachment.altText ?? attachment.name ?? 'Figure'}
              </p>
              {isSelected ? (
                <span className="absolute top-1.5 right-1.5 flex justify-center items-center w-5 h-5 rounded-full text-primary-foreground bg-primary">
                  <Check className="w-3.5 h-3.5" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </SectionWithHeading>
  );
}
