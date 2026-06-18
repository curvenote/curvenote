import { useEffect, useMemo } from 'react';
import { Image as ImageIcon, Check } from 'lucide-react';
import { SectionWithHeading, cn } from '@curvenote/scms-core';
import { collectAllFigures } from './DocxPreviewer';
import { encodeFigureLocator } from './thumbnailSelection';
import type { DocxPreviewItem } from './fetchPreviews.server';

export interface ChooseThumbnailSectionProps {
  previewList: DocxPreviewItem[];
  /** Currently selected thumbnail locator (see thumbnailSelection.ts), or null. */
  value: string | null;
  /** Report the selected thumbnail locator to the parent (drives the submit field). */
  onChange: (locator: string | null) => void;
}

export function ChooseThumbnailSection({
  previewList,
  value,
  onChange,
}: ChooseThumbnailSectionProps) {
  const figures = useMemo(() => collectAllFigures(previewList), [previewList]);
  const locators = useMemo(() => figures.map((f) => encodeFigureLocator(f)), [figures]);

  // Default to the first figure; reset if the current selection is no longer valid
  // (e.g. previews changed after a re-upload).
  useEffect(() => {
    if (locators.length === 0) {
      if (value !== null) onChange(null);
      return;
    }
    if (value == null || !locators.includes(value)) {
      onChange(locators[0]);
    }
  }, [locators, value, onChange]);

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
        {figures.map(({ attachment }, index) => {
          const src = attachment.data
            ? `data:${attachment.mimeType};base64,${attachment.data}`
            : undefined;
          const locator = locators[index];
          const isSelected = locator === value;
          return (
            <button
              type="button"
              key={locator}
              onClick={() => onChange(locator)}
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
