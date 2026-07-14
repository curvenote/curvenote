import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Columns4, Image as ImageIcon, Check, LayoutGrid, RefreshCw } from 'lucide-react';
import { LoadingSpinner, SectionWithHeading, cn, ui } from '@curvenote/scms-core';
import { collectAllFigures } from './DocumentPreviewer';
import {
  buildThumbnailCandidateLocators,
  encodeFigureLocator,
  resolveThumbnailSelection,
} from './thumbnailSelection';
import type { DocumentPreviewItem } from './fetchPreviews.server';
import { useDelayedFlag } from './useDelayedFlag';

/** Reveal the skip escape hatch after this long in the figures busy state. */
const FIGURES_SKIP_HATCH_DELAY_MS = 15000;

/** Fixed height for the empty gallery placeholder — busy overlay must not expand it. */
const EMPTY_GALLERY_HEIGHT_CLASS = 'h-36';

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
  /** True while phase-B figure extraction is in progress. */
  isFiguresLoading?: boolean;
  /** Show a manual re-try control after the latest figures fetch has finished. */
  showFiguresRetry?: boolean;
  onRetryFigures?: () => void;
  /**
   * When provided, a long-running figures busy state (>15s) reveals an escape hatch
   * that calls this to abandon thumbnail generation and continue without candidates.
   */
  onSkipFigures?: () => void;
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

  useEffect(() => {
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

function FiguresRetryButton({ onRetry, disabled }: { onRetry: () => void; disabled?: boolean }) {
  return (
    <ui.Button
      type="button"
      variant="link"
      size="sm"
      className="p-0 h-auto text-xs"
      onClick={onRetry}
      disabled={disabled}
      title="Re-try thumbnail extraction"
    >
      <RefreshCw className="mr-px w-3.5 h-3.5" />
      re-try
    </ui.Button>
  );
}

function figureLabelFromKey(key: string): string {
  const segment = key.split('/').pop() ?? key;
  const withoutExt = segment.replace(/\.[^.]+$/, '');
  return withoutExt || 'Figure';
}

function FiguresBusyOverlay({
  message,
  onSkipFigures,
  compact = false,
}: {
  message: string;
  onSkipFigures?: () => void;
  /** Smaller spinner when the overlay sits inside a gallery tile slot. */
  compact?: boolean;
}) {
  const showSkipHatch = useDelayedFlag(true, FIGURES_SKIP_HATCH_DELAY_MS);

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-md bg-background/80 px-4 text-center backdrop-blur-[1px]"
      aria-busy="true"
      aria-live="polite"
    >
      <LoadingSpinner size={compact ? 24 : 32} />
      <p className={cn('text-stone-500', compact ? 'text-xs' : 'text-sm')}>{message}</p>
      {showSkipHatch && onSkipFigures ? (
        <p className="max-w-sm text-xs text-stone-500">
          This is taking longer than usual. You can{' '}
          <button
            type="button"
            onClick={onSkipFigures}
            className="font-medium text-primary underline underline-offset-2 hover:no-underline"
          >
            skip generating thumbnails
          </button>{' '}
          and continue without a document image.
        </p>
      ) : null}
    </div>
  );
}

function StandaloneEmptyGallery({
  showBusy,
  emptyMessage,
  busyMessage,
  onSkipFigures,
}: {
  showBusy: boolean;
  emptyMessage: string;
  busyMessage: string;
  onSkipFigures?: () => void;
}) {
  return (
    <div
      className={cn(
        'relative rounded-md border border-dashed border-stone-300 bg-white dark:border-stone-600 dark:bg-stone-900',
        EMPTY_GALLERY_HEIGHT_CLASS,
      )}
    >
      {showBusy ? (
        <FiguresBusyOverlay message={busyMessage} onSkipFigures={onSkipFigures} />
      ) : (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}

/** Occupies remaining gallery width beside a pinned tile while figure extraction runs. */
function FiguresLoadingPlaceholder({
  layout,
  message,
  onSkipFigures,
  tileHeight,
}: {
  layout: ThumbnailGalleryLayout;
  message: string;
  onSkipFigures?: () => void;
  /** Matched to the pinned thumbnail column so the row stays one height. */
  tileHeight?: number;
}) {
  return (
    <div
      style={tileHeight != null ? { height: tileHeight } : undefined}
      className={cn(
        'flex min-h-0 flex-col gap-[1px] items-stretch self-stretch',
        layout === 'row' ? 'min-w-0 flex-1 shrink' : 'w-full',
      )}
    >
      <CurrentLabel visible={false} />
      <div className="relative flex min-h-0 flex-1 flex-col gap-1 rounded-md border border-dashed border-stone-300 bg-white px-2 py-1 dark:border-stone-600 dark:bg-stone-900">
        <p className="pr-6 text-xs invisible truncate min-h-[1rem]" aria-hidden>
          &nbsp;
        </p>
        <div className="relative min-h-0 flex-1 w-full overflow-hidden rounded bg-stone-50 dark:bg-stone-800/50">
          <FiguresBusyOverlay message={message} onSkipFigures={onSkipFigures} compact />
        </div>
      </div>
    </div>
  );
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
  ref,
}: {
  label: string;
  imageSrc: string | undefined;
  imageAlt: string;
  isSelected: boolean;
  isCurrent?: boolean;
  onSelect: () => void;
  layout: ThumbnailGalleryLayout;
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col gap-[1px] items-stretch self-stretch',
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
  isFiguresLoading = false,
  showFiguresRetry = false,
  onRetryFigures,
  onSkipFigures,
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

  const figuresBusyMessage = 'Generating thumbnail options…';
  const hasPinnedThumbnail = Boolean(pinnedThumbnail);
  const hasExtractedFigures = figures.length > 0;
  const hasGalleryTiles = hasPinnedThumbnail || hasExtractedFigures;
  const showStandaloneEmpty = !hasGalleryTiles;
  const showGalleryRow = hasGalleryTiles || (hasPinnedThumbnail && isFiguresLoading);
  const showPinnedLoadingPlaceholder =
    hasPinnedThumbnail && isFiguresLoading && !hasExtractedFigures;
  const showStandaloneFiguresBusy = isFiguresLoading && showStandaloneEmpty;
  const tileCount =
    (hasPinnedThumbnail ? 1 : 0) + figures.length + (showPinnedLoadingPlaceholder ? 1 : 0);
  const { galleryRef, overflows: rowGalleryOverflows } = useRowGalleryOverflow({
    tileCount,
    layout,
  });
  const pinnedTileRef = useRef<HTMLDivElement>(null);
  const [pinnedTileHeight, setPinnedTileHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!showPinnedLoadingPlaceholder) {
      setPinnedTileHeight(undefined);
      return;
    }

    const el = pinnedTileRef.current;
    if (!el) return;

    const syncHeight = () => {
      setPinnedTileHeight(el.getBoundingClientRect().height);
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [showPinnedLoadingPlaceholder, pinnedLabel, pinnedThumbnail?.signedUrl, layout]);

  useEffect(() => {
    if (!rowGalleryOverflows && layout === 'grid') {
      setLayout('row');
    }
  }, [rowGalleryOverflows, layout]);

  const showFiguresRetryControl = showFiguresRetry && onRetryFigures != null;
  const showGalleryToolbar = showFiguresRetryControl || rowGalleryOverflows;

  return (
    <SectionWithHeading
      heading="Choose a Thumbnail"
      icon={<ImageIcon className="w-5 h-5" />}
      className={cn('space-y-4', showStandaloneEmpty ? 'max-w-3xl' : 'max-w-none')}
    >
      <p className="text-muted-foreground">
        Select an image from your document to use as the thumbnail.
      </p>
      {showStandaloneEmpty ? (
        <div className="space-y-2">
          {showFiguresRetryControl ? (
            <div className="flex justify-end">
              <FiguresRetryButton onRetry={onRetryFigures} disabled={isFiguresLoading} />
            </div>
          ) : null}
          <StandaloneEmptyGallery
            showBusy={showStandaloneFiguresBusy}
            emptyMessage={emptyMessage}
            busyMessage={figuresBusyMessage}
            onSkipFigures={onSkipFigures}
          />
        </div>
      ) : null}
      {showGalleryRow ? (
        <div className="relative">
          {showGalleryToolbar ? (
            <div className="absolute top-0 right-1 z-10 flex gap-2 items-center">
              {showFiguresRetryControl ? (
                <FiguresRetryButton onRetry={onRetryFigures} disabled={isFiguresLoading} />
              ) : null}
              {rowGalleryOverflows ? (
                <GalleryLayoutToggle value={layout} onChange={setLayout} />
              ) : null}
            </div>
          ) : null}
          <div
            ref={galleryRef}
            className={cn(
              'py-1 pt-2',
              layout === 'row'
                ? cn(
                    'flex items-stretch overflow-x-auto overflow-y-hidden overscroll-x-contain gap-4 px-1 [scrollbar-gutter:stable]',
                    showGalleryToolbar && 'pr-14',
                  )
                : 'grid grid-cols-2 items-stretch gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
            )}
          >
            {pinnedThumbnail && pinnedLocator ? (
              <ThumbnailTile
                key={pinnedLocator}
                ref={showPinnedLoadingPlaceholder ? pinnedTileRef : undefined}
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
            {showPinnedLoadingPlaceholder ? (
              <FiguresLoadingPlaceholder
                layout={layout}
                message={figuresBusyMessage}
                onSkipFigures={onSkipFigures}
                tileHeight={pinnedTileHeight}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </SectionWithHeading>
  );
}
