import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Columns4, Image as ImageIcon, Check, LayoutGrid } from 'lucide-react';
import { SectionWithHeading, cn, ui } from '@curvenote/scms-core';
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

type ThumbnailGalleryLayout = 'row' | 'grid';

/** Match grid column widths at each breakpoint so aspect-square tiles stay the same height. */
const rowTileWidthClassName =
  'shrink-0 w-[calc((100%-1rem)/2)] sm:w-[calc((100%-2rem)/3)] md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-4rem)/5)]';

const galleryLayoutToggleItemClassName =
  'px-1 bg-transparent text-muted-foreground/35 hover:bg-transparent hover:text-muted-foreground/50 data-[state=on]:bg-transparent data-[state=on]:text-foreground/70';

/** Visible tile columns in row layout at each breakpoint (matches rowTileWidthClassName). */
function rowGalleryColumnCount(containerWidth: number): number {
  if (containerWidth >= 1024) return 5;
  if (containerWidth >= 768) return 4;
  if (containerWidth >= 640) return 3;
  return 2;
}

function useRowGalleryOverflow({
  tileCount,
  layout,
}: {
  tileCount: number;
  layout: ThumbnailGalleryLayout;
}) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  const measureOverflow = useCallback(() => {
    const el = galleryRef.current;
    if (!el || tileCount === 0) {
      setOverflows(false);
      return;
    }

    if (layout === 'row') {
      setOverflows(el.scrollWidth > el.clientWidth + 1);
      return;
    }

    setOverflows(tileCount > rowGalleryColumnCount(el.clientWidth));
  }, [layout, tileCount]);

  useLayoutEffect(() => {
    measureOverflow();
    const el = galleryRef.current;
    if (!el) return;

    const observer = new ResizeObserver(measureOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measureOverflow]);

  return { galleryRef, overflows };
}

function GalleryLayoutToggle({
  value,
  onChange,
}: {
  value: ThumbnailGalleryLayout;
  onChange: (layout: ThumbnailGalleryLayout) => void;
}) {
  return (
    <ui.ToggleGroup
      type="single"
      value={value}
      variant="default"
      size="sm"
      aria-label="Thumbnail gallery layout"
      className="gap-0"
      onValueChange={(next) => {
        if (next === 'row' || next === 'grid') onChange(next);
      }}
    >
      <ui.ToggleGroupItem
        value="row"
        aria-label="Single row"
        title="Single row"
        className={galleryLayoutToggleItemClassName}
      >
        <Columns4 className="w-5 h-5" />
      </ui.ToggleGroupItem>
      <ui.ToggleGroupItem
        value="grid"
        aria-label="Grid"
        title="Grid"
        className={galleryLayoutToggleItemClassName}
      >
        <LayoutGrid className="w-5 h-5" />
      </ui.ToggleGroupItem>
    </ui.ToggleGroup>
  );
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
        'text-xs font-medium leading-none text-left min-h-[1rem]',
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
  layout,
}: {
  label: string;
  imageSrc: string | undefined;
  imageAlt: string;
  isSelected: boolean;
  isCurrent?: boolean;
  onSelect: () => void;
  layout: ThumbnailGalleryLayout;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-[1px] justify-center items-stretch h-full',
        layout === 'row' ? rowTileWidthClassName : 'w-full min-w-0',
      )}
    >
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
  const [layout, setLayout] = useState<ThumbnailGalleryLayout>('row');
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
  const tileCount = (pinnedThumbnail ? 1 : 0) + figures.length;
  const { galleryRef, overflows: rowGalleryOverflows } = useRowGalleryOverflow({
    tileCount,
    layout,
  });

  useLayoutEffect(() => {
    if (!rowGalleryOverflows && layout === 'grid') {
      setLayout('row');
    }
  }, [rowGalleryOverflows, layout]);

  return (
    <SectionWithHeading
      heading="Choose a Thumbnail"
      icon={<ImageIcon className="w-5 h-5" />}
      className={cn('space-y-4', !hasTiles ? 'max-w-3xl' : 'max-w-none')}
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
        <div className="relative">
          {rowGalleryOverflows ? (
            <div className="absolute top-0 right-1 z-10">
              <GalleryLayoutToggle value={layout} onChange={setLayout} />
            </div>
          ) : null}
          <div
            ref={galleryRef}
            className={cn(
              'items-center py-1 pt-2',
              layout === 'row'
                ? cn(
                    'flex overflow-x-auto overflow-y-hidden overscroll-x-contain gap-4 px-1 [scrollbar-gutter:stable]',
                    rowGalleryOverflows && 'pr-14',
                  )
                : 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
            )}
          >
            {pinnedThumbnail && pinnedLocator ? (
              <ThumbnailTile
                key={pinnedLocator}
                layout={layout}
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
                  layout={layout}
                  label={label}
                  imageSrc={figure.signedUrl}
                  imageAlt={label}
                  isSelected={locator === selectedLocator}
                  onSelect={() => onChange(locator)}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </SectionWithHeading>
  );
}
