import { useEffect, useRef, useState } from 'react';

interface UsePollingOptions<T> {
  url: string;
  interval: number;
  enabled: boolean;
  pollImmediately?: boolean;
  numRetries?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  onComplete?: (data: T) => void;
  shouldStop?: (data: T) => boolean;
}

interface UsePollingResult<T> {
  data: T | null;
  isPolling: boolean;
  error: Error | null;
}

export function usePolling<T>({
  url,
  interval,
  enabled,
  pollImmediately,
  numRetries = 0,
  onSuccess,
  onError,
  onComplete,
  shouldStop,
}: UsePollingOptions<T>): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      // Clear interval if polling is disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      retryCountRef.current = 0;
      setError(null);
      return;
    }

    const poll = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const result = await response.json();
          setData(result);
          setError(null);
          retryCountRef.current = 0; // Reset retry count on success

          onSuccess?.(result);

          // Check if we should stop polling
          if (shouldStop?.(result)) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            onComplete?.(result);
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (err) {
        const pollError = err instanceof Error ? err : new Error('Unknown error');

        // Check if we should retry
        if (retryCountRef.current < numRetries) {
          retryCountRef.current += 1;
          console.warn(
            `Polling retry ${retryCountRef.current}/${numRetries} for ${url}:`,
            pollError.message,
          );
          return; // Don't set error or stop polling, just retry on next interval
        }

        // Exhausted retries, treat as fatal error
        setError(pollError);
        onError?.(pollError);

        // Stop polling on fatal error
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    // Poll immediately
    if (pollImmediately) poll();

    // Set up interval
    intervalRef.current = setInterval(poll, interval);

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      retryCountRef.current = 0;
    };
  }, [url, interval, enabled, numRetries, onSuccess, onError, onComplete, shouldStop]);

  return {
    data,
    isPolling: intervalRef.current !== null,
    error,
  };
}
