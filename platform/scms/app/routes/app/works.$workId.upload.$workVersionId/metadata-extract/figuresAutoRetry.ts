/** Max automatic phase-B figure fetches per pending path set; manual retry bypasses this. */
export const MAX_FIGURES_AUTO_ATTEMPTS = 2;

export type FiguresFetcherState = 'idle' | 'loading' | 'submitting';

export interface PendingFigurePreview {
  path: string;
  figuresPending?: boolean;
}

/** Stable signature for the set of previews still awaiting figure extraction. */
export function pendingFigurePathsKey(previewList: ReadonlyArray<PendingFigurePreview>): string {
  return previewList
    .filter((preview) => preview.figuresPending === true)
    .map((preview) => preview.path)
    .sort()
    .join('\0');
}

export function shouldResetFiguresAutoAttemptsForPendingKey(args: {
  previousKey: string;
  nextKey: string;
}): boolean {
  return args.previousKey !== args.nextKey;
}

/** Only clear the finished latch while pending work remains; success clears the set to "". */
export function shouldClearFiguresFetchFinishedForPendingKey(args: { nextKey: string }): boolean {
  return args.nextKey !== '';
}

export function shouldAutoSubmitFiguresFetch(args: {
  shouldFetchPreviewFigures: boolean;
  fetcherState: FiguresFetcherState;
  autoAttempts: number;
}): boolean {
  if (!args.shouldFetchPreviewFigures) return false;
  if (args.fetcherState !== 'idle') return false;
  return args.autoAttempts < MAX_FIGURES_AUTO_ATTEMPTS;
}

export function nextAutoFiguresAttempts(autoAttempts: number): number {
  return autoAttempts + 1;
}

export function applyFiguresFetcherStateTransition(args: {
  fetcherState: FiguresFetcherState;
  wasInFlight: boolean;
}): { wasInFlight: boolean; fetchFinished: boolean } {
  if (args.fetcherState !== 'idle') {
    return { wasInFlight: true, fetchFinished: false };
  }
  if (args.wasInFlight) {
    return { wasInFlight: false, fetchFinished: true };
  }
  return { wasInFlight: false, fetchFinished: false };
}

export function shouldManualRetryFigures(fetcherState: FiguresFetcherState): boolean {
  return fetcherState === 'idle';
}

export function shouldShowFiguresRetry(args: {
  figuresFetchFinished: boolean;
  isGeneratingFigures: boolean;
}): boolean {
  return args.figuresFetchFinished && !args.isGeneratingFigures;
}
