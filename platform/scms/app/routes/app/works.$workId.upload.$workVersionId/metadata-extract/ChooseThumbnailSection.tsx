import { useMemo } from 'react';
import { Image as ImageIcon, Check } from 'lucide-react';
import { SectionWithHeading, cn } from '@curvenote/scms-core';
import { collectAllFigures } from './DocumentPreviewer';
import { encodeFigureLocator, resolveThumbnailSelection } from './thumbnailSelection';
import type { DocumentPreviewItem } from './fetchPreviews.server';

export type PinnedThumbnail = {
  key: string;
  signedUrl: string;
};

export interface ChooseThumbnailSectionProps {
  previewList: DocumentPreviewItem[];
  /** Currently selected thumbnail locator (see thumbnailSelection.ts), or null. */
  value: string | null;
  /** Report the selected thumbnail locator to the parent (drives the submit field). */
  onChange: (locator: string | null) => void;
  /** Inherited thumbnail from a prior version — shown first with a "Current" badge. */
  pinnedThumbnail?: PinnedThumbnail | null;
}

export function ChooseThumbnailSection({
  previewList,
  value,
  onChange,
  pinnedThumbnail = null,
}: ChooseThumbnailSectionProps) {
  const figures = useMemo(() => {
    const all = collectAllFigures(previewList);
    if (!pinnedThumbnail?.key) return all;
    return all.filter(({ figure }) => figure.key !== pinnedThumbnail.key);
  }, [previewList, pinnedThumbnail?.key]);

  const pinnedLocator = pinnedThumbnail?.key
    ? encodeFigureLocator(pinnedThumbnail.key)
    : null;
  const figureLocators = useMemo(
    () => figures.map((f) => encodeFigureLocator(f.figure.key)),
    [figures],
  );
  const allLocators = useMemo(
    () => (pinnedLocator ? [pinnedLocator, ...figureLocators] : figureLocators),
    [pinnedLocator, figureLocators],
  );
  const selectedLocator = resolveThumbnailSelection(allLocators, value);

  const emptyMessage =
    previewList.length === 0 && !pinnedThumbnail
      ? 'No images yet'
      : 'No figures were found in the current document previews.';

  const hasTiles = Boolean(pinnedThumbnail) || figures.length > 0;

  return (
    <SectionWithHeading
      heading="Choose a Thumbnail"
      icon={<ImageIcon className="w-5 h-5" />}
      className={cn('space-y-4', !hasTiles ? 'max-w-3xl' : 'max-w-5xl')}
    >
      <p className="text-muted-foreground">
        Select an image from your document to use as the thumbnail.
      </p>
      {!hasTiles ? (
        <div className="flex min-h-36 items-center justify-center rounded-md border border-dashed border-stone-300 bg-white px-6 py-8 text-center dark:border-stone-600 dark:bg-stone-900">
          <p className="max-w-sm text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : null}
      {hasTiles ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {pinnedThumbnail && pinnedLocator ? (
            <button
              type="button"
              key={pinnedLocator}
              onClick={() => onChange(pinnedLocator)}
              aria-pressed={pinnedLocator === selectedLocator}
              title="Current thumbnail"
              className={cn(
                'group relative flex flex-col gap-1 rounded-md border px-2 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
                pinnedLocator === selectedLocator
                  ? 'border-green-400 bg-green-50 hover:border-green-400 dark:border-green-600 dark:bg-green-800 dark:hover:border-green-600'
                  : 'border-stone-200 bg-white hover:border-stone-400 dark:border-stone-500 dark:bg-stone-900 dark:hover:border-stone-400',
              )}
            >
              <p className="pr-6 text-xs truncate text-muted-foreground/80">Current</p>
              <div className="flex overflow-hidden justify-center items-center min-h-0 rounded aspect-square bg-stone-100 dark:bg-stone-800">
                <img
                  src={pinnedThumbnail.signedUrl}
                  alt="Current thumbnail"
                  className="object-contain w-full h-full"
                />
              </div>
              {pinnedLocator === selectedLocator ? (
                <span className="absolute top-1.5 right-1.5 flex justify-center items-center w-5 h-5 text-white bg-green-500 rounded-full border border-green-500 dark:bg-green-600 dark:border-green-600">
                  <Check className="w-3.5 h-3.5" />
                </span>
              ) : (
                <span
                  className="absolute top-1.5 right-1.5 w-5 h-5 bg-white rounded-full border border-stone-300 shadow-sm dark:bg-stone-900 dark:border-stone-500"
                  aria-hidden
                />
              )}
            </button>
          ) : null}
          {figures.map(({ figure }, index) => {
            const src = figure.signedUrl;
            const locator = figureLocators[index];
            const isSelected = locator === selectedLocator;
            return (
              <button
                type="button"
                key={locator}
                onClick={() => onChange(locator)}
                aria-pressed={isSelected}
                title={figure.altText ?? figure.name ?? 'Figure'}
                className={cn(
                  'group relative flex flex-col gap-1 rounded-md border px-2 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
                  isSelected
                    ? 'border-green-400 bg-green-50 hover:border-green-400 dark:border-green-600 dark:bg-green-800 dark:hover:border-green-600'
                    : 'border-stone-200 bg-white hover:border-stone-400 dark:border-stone-500 dark:bg-stone-900 dark:hover:border-stone-400',
                )}
              >
                <p
                  className="pr-6 text-xs truncate text-muted-foreground/80"
                  title={figure.altText ?? figure.name}
                >
                  {figure.altText ?? figure.name ?? 'Figure'}
                </p>
                <div className="flex overflow-hidden justify-center items-center min-h-0 rounded aspect-square bg-stone-100 dark:bg-stone-800">
                  {src ? (
                    <img
                      src={src}
                      alt={figure.altText ?? figure.name ?? ''}
                      className="object-contain w-full h-full"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">[No data]</span>
                  )}
                </div>
                {isSelected ? (
                  <span className="absolute top-1.5 right-1.5 flex justify-center items-center w-5 h-5 text-white bg-green-500 rounded-full border border-green-500 dark:bg-green-600 dark:border-green-600">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                ) : (
                  <span
                    className="absolute top-1.5 right-1.5 w-5 h-5 bg-white rounded-full border border-stone-300 shadow-sm dark:bg-stone-900 dark:border-stone-500"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </SectionWithHeading>
  );
}
