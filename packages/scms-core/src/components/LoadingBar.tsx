import type { FetcherWithComponents } from 'react-router';
import { useNavigation } from 'react-router';
import { useEffect, useMemo, useState, useRef } from 'react';
import classNames from 'classnames';

/**
 * Show a loading progess bad if the load takes more than 150ms
 */
function useLoading(fetcher?: FetcherWithComponents<any>) {
  const transitionState = fetcher?.state ?? useNavigation().state;
  const ref = useMemo<{ start?: NodeJS.Timeout; finish?: NodeJS.Timeout }>(() => ({}), []);
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (transitionState === 'loading') {
      ref.start = setTimeout(() => {
        setShowLoading(true);
      }, 50);
    } else {
      if (ref.start) {
        // We have stoped loading in <150ms
        clearTimeout(ref.start);
        delete ref.start;
        setShowLoading(false);
        return;
      }
      ref.finish = setTimeout(() => {
        setShowLoading(false);
      }, 150);
    }
    return () => {
      if (ref.start) {
        clearTimeout(ref.start);
        delete ref.start;
      }
      if (ref.finish) {
        clearTimeout(ref.finish);
        delete ref.finish;
      }
    };
  }, [transitionState]);

  return {
    showLoading,
    isLoading: transitionState === 'loading',
  };
}

export function LoadingBar({ fetcher }: { fetcher?: FetcherWithComponents<any> }) {
  const { isLoading, showLoading } = useLoading(fetcher);
  const [isPulseState, setIsPulseState] = useState(false);
  const pulseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevIsLoadingRef = useRef(isLoading);

  useEffect(() => {
    // Reset pulse state when a new loading cycle begins (isLoading transitions from false to true)
    // This handles the case where loads happen in quick succession and showLoading never becomes false
    if (isLoading && !prevIsLoadingRef.current && isPulseState) {
      setIsPulseState(false);
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = null;
      }
    }

    // Update previous isLoading value
    prevIsLoadingRef.current = isLoading;

    if (showLoading && !isPulseState) {
      pulseTimeoutRef.current = setTimeout(() => {
        setIsPulseState(true);
      }, 5000);
    } else if (!showLoading && isPulseState) {
      setIsPulseState(false);
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = null;
      }
    }

    return () => {
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = null;
      }
    };
  }, [showLoading, isLoading, isPulseState]);

  if (!showLoading) return null;

  return (
    <>
      <div className="absolute top-0 right-0 left-0 z-50">
        <div
          className={classNames('min-w-[10px] bg-blue-500 origin-left', {
            'animate-load': !isPulseState && showLoading,
            'h-[3px]': !isPulseState && showLoading,
            'h-[5px]': isPulseState && showLoading,
            'w-full animate-pulse': isPulseState && showLoading,
          })}
        />
      </div>
    </>
  );
}
