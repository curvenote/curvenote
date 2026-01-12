import type { FetcherWithComponents } from 'react-router';
import { useNavigation } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
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
  if (!showLoading) return null;
  return (
    <div
      className={classNames(
        'min-w-[50px] absolute h-[3px] z-50 bg-blue-500 left-0 bottom-0 transition-transform origin-left',
        {
          'animate-load scale-x-40': isLoading,
          'scale-x-100': !isLoading,
        },
      )}
    />
  );
}
