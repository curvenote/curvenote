import { useMemo } from 'react';
import { Image as ImageIcon, Check } from 'lucide-react';
import { SectionWithHeading, cn } from '@curvenote/scms-core';
import { collectAllFigures } from './DocumentPreviewer';
import {
  buildThumbnailCandidateLocators,
  encodeFigureLocator,
  resolveThumbnailSelection,
} from './thumbnailSelection';
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
  /** Inherited thumbnail from a prior version — always rendered first when present. */
  pinnedThumbnail?: PinnedThumbnail | null;
}

function figureLabelFromKey(key: string): string {
  const segment = key.split('/').pop() ?? key;
  const withoutExt = segment.replace(/\.[^.]+$/, '');
  return withoutExt || 'Figure';
}

function CurrentLabel({ visible }: { visible: boolean }) {
  return (
    <p
      className={cn(
        'text-xs font-medium text-center leading-none min-h-[1rem]',
        visible ? 'text-blue-600 dark:text-blue-400' : 'invisible',
      )}
      aria-hidden={!visible}
    >
      Current
    </p>
  );
}

function ThumbnailTile({
  label,
  imageSrc,
  imageAlt,
  isSelected,
  isCurrent,
  onSelect,
}: {
  label: string;
  imageSrc: string | undefined;
  imageAlt: string;
  isSelected: boolean;
  isCurrent?: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="flex flex-col gap-1 justify-center items-stretch h-full">
      <CurrentLabel visible={Boolean(isCurrent)} />
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        title={label}
        className={cn(
          'group relative flex flex-col gap-1 rounded-md border px-2 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 w-full',
          isCurrent &&
            'ring-2 ring-blue-500 ring-offset-2 ring-offset-background dark:ring-blue-400',
          isSelected
            ? 'border-green-400 bg-green-50 hover:border-green-400 dark:border-green-600 dark:bg-green-800 dark:hover:border-green-600'
            : 'border-stone-200 bg-white hover:border-stone-400 dark:border-stone-500 dark:bg-stone-900 dark:hover:border-stone-400',
        )}
      >
        <p className="pr-6 text-xs truncate text-muted-foreground/80" title={label}>
          {label}
        </p>
        <div className="flex overflow-hidden justify-center items-center min-h-0 rounded aspect-square bg-stone-100 dark:bg-stone-800">
          {imageSrc ? (
            <img src={imageSrc} alt={imageAlt} className="object-contain w-full h-full" />
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
    </div>
  );
}

export function ChooseThumbnailSection({
  previewList,
  value,
  onChange,
  pinnedThumbnail = null,
}: ChooseThumbnailSectionProps) {
  const allFigures = useMemo(() => collectAllFigures(previewList), [previewList]);

  const pinnedFigure = useMemo(() => {
    if (!pinnedThumbnail?.key) return null;
    return allFigures.find(({ figure }) => figure.key === pinnedThumbnail.key)?.figure ?? null;
  }, [allFigures, pinnedThumbnail?.key]);

  const figures = useMemo(() => {
    if (!pinnedThumbnail?.key) return allFigures;
    return allFigures.filter(({ figure }) => figure.key !== pinnedThumbnail.key);
  }, [allFigures, pinnedThumbnail?.key]);

  const pinnedLocator = pinnedThumbnail?.key ? encodeFigureLocator(pinnedThumbnail.key) : null;
  const pinnedLabel =
    pinnedFigure?.altText ??
    pinnedFigure?.name ??
    (pinnedThumbnail?.key ? figureLabelFromKey(pinnedThumbnail.key) : 'Figure');

  const figureLocators = useMemo(
    () => figures.map((f) => encodeFigureLocator(f.figure.key)),
    [figures],
  );
  const allLocators = useMemo(
    () => buildThumbnailCandidateLocators(figureLocators, pinnedThumbnail?.key),
    [figureLocators, pinnedThumbnail?.key],
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
        <div className="flex justify-center items-center px-6 py-8 text-center bg-white rounded-md border border-dashed min-h-36 border-stone-300 dark:border-stone-600 dark:bg-stone-900">
          <p className="max-w-sm text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : null}
      {hasTiles ? (
        <div className="grid grid-cols-2 gap-4 items-center sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {pinnedThumbnail && pinnedLocator ? (
            <ThumbnailTile
              key={pinnedLocator}
              label={pinnedLabel}
              imageSrc={pinnedThumbnail.signedUrl}
              imageAlt={pinnedLabel}
              isSelected={pinnedLocator === selectedLocator}
              isCurrent
              onSelect={() => onChange(pinnedLocator)}
            />
          ) : null}
          {figures.map(({ figure }, index) => {
            const locator = figureLocators[index];
            const label = figure.altText ?? figure.name ?? 'Figure';
            return (
              <ThumbnailTile
                key={locator}
                label={label}
                imageSrc={figure.signedUrl}
                imageAlt={label}
                isSelected={locator === selectedLocator}
                onSelect={() => onChange(locator)}
              />
            );
          })}
        </div>
      ) : null}
    </SectionWithHeading>
  );
}
