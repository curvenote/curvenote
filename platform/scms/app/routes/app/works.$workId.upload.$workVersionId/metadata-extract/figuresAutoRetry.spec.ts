// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  MAX_FIGURES_AUTO_ATTEMPTS,
  applyFiguresFetcherStateTransition,
  nextAutoFiguresAttempts,
  pendingFigurePathsKey,
  shouldAutoSubmitFiguresFetch,
  shouldManualRetryFigures,
  shouldResetFiguresAutoAttemptsForPendingKey,
  shouldShowFiguresRetry,
} from './figuresAutoRetry';

describe('pendingFigurePathsKey', () => {
  it('sorts pending paths into a stable signature', () => {
    const key = pendingFigurePathsKey([
      { path: 'b.docx', figuresPending: true },
      { path: 'a.docx', figuresPending: true },
      { path: 'c.docx', figuresPending: false },
    ]);
    expect(key).toBe('a.docx\0b.docx');
  });

  it('returns empty string when nothing is pending', () => {
    expect(pendingFigurePathsKey([{ path: 'a.docx', figuresPending: false }])).toBe('');
  });
});

describe('shouldResetFiguresAutoAttemptsForPendingKey', () => {
  it('resets when the pending path set changes', () => {
    expect(
      shouldResetFiguresAutoAttemptsForPendingKey({ previousKey: 'a.docx', nextKey: 'b.docx' }),
    ).toBe(true);
  });

  it('does not reset when the pending path set is unchanged', () => {
    expect(
      shouldResetFiguresAutoAttemptsForPendingKey({ previousKey: 'a.docx', nextKey: 'a.docx' }),
    ).toBe(false);
  });
});

describe('shouldAutoSubmitFiguresFetch', () => {
  it('submits while under the auto-attempt cap and fetcher is idle', () => {
    expect(
      shouldAutoSubmitFiguresFetch({
        shouldFetchPreviewFigures: true,
        fetcherState: 'idle',
        autoAttempts: 0,
      }),
    ).toBe(true);
    expect(
      shouldAutoSubmitFiguresFetch({
        shouldFetchPreviewFigures: true,
        fetcherState: 'idle',
        autoAttempts: MAX_FIGURES_AUTO_ATTEMPTS - 1,
      }),
    ).toBe(true);
  });

  it('stops auto-submit after the cap is reached', () => {
    expect(
      shouldAutoSubmitFiguresFetch({
        shouldFetchPreviewFigures: true,
        fetcherState: 'idle',
        autoAttempts: MAX_FIGURES_AUTO_ATTEMPTS,
      }),
    ).toBe(false);
  });

  it('does not submit while fetcher is in flight', () => {
    expect(
      shouldAutoSubmitFiguresFetch({
        shouldFetchPreviewFigures: true,
        fetcherState: 'loading',
        autoAttempts: 0,
      }),
    ).toBe(false);
  });

  it('does not submit when figures fetch is disabled', () => {
    expect(
      shouldAutoSubmitFiguresFetch({
        shouldFetchPreviewFigures: false,
        fetcherState: 'idle',
        autoAttempts: 0,
      }),
    ).toBe(false);
  });
});

describe('nextAutoFiguresAttempts', () => {
  it('increments the auto-attempt counter', () => {
    expect(nextAutoFiguresAttempts(0)).toBe(1);
    expect(nextAutoFiguresAttempts(1)).toBe(2);
  });
});

describe('applyFiguresFetcherStateTransition', () => {
  it('marks in-flight when fetcher leaves idle', () => {
    expect(
      applyFiguresFetcherStateTransition({ fetcherState: 'submitting', wasInFlight: false }),
    ).toEqual({ wasInFlight: true, fetchFinished: false });
  });

  it('marks finished only after an in-flight fetch returns to idle', () => {
    expect(applyFiguresFetcherStateTransition({ fetcherState: 'idle', wasInFlight: true })).toEqual(
      { wasInFlight: false, fetchFinished: true },
    );
  });

  it('does not mark finished on initial idle', () => {
    expect(
      applyFiguresFetcherStateTransition({ fetcherState: 'idle', wasInFlight: false }),
    ).toEqual({ wasInFlight: false, fetchFinished: false });
  });
});

describe('shouldManualRetryFigures', () => {
  it('allows manual retry only when fetcher is idle', () => {
    expect(shouldManualRetryFigures('idle')).toBe(true);
    expect(shouldManualRetryFigures('loading')).toBe(false);
  });

  it('bypasses the auto-attempt cap by design', () => {
    expect(
      shouldAutoSubmitFiguresFetch({
        shouldFetchPreviewFigures: true,
        fetcherState: 'idle',
        autoAttempts: MAX_FIGURES_AUTO_ATTEMPTS,
      }),
    ).toBe(false);
    expect(shouldManualRetryFigures('idle')).toBe(true);
  });
});

describe('shouldShowFiguresRetry', () => {
  it('shows retry after a fetch finishes and generation is idle', () => {
    expect(shouldShowFiguresRetry({ figuresFetchFinished: true, isGeneratingFigures: false })).toBe(
      true,
    );
  });

  it('hides retry while generation is in progress', () => {
    expect(shouldShowFiguresRetry({ figuresFetchFinished: true, isGeneratingFigures: true })).toBe(
      false,
    );
  });
});
