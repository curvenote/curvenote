import { useState, useRef, useEffect, useCallback } from 'react';
import type { FetcherWithComponents } from 'react-router';

interface UseExpandableFormOptions {
  animationDuration?: number; // ms, default 200
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function useExpandableForm(
  fetcher: FetcherWithComponents<any>,
  options?: UseExpandableFormOptions,
) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const animationDuration = options?.animationDuration ?? 200;

  // Expand the form
  const expand = useCallback(() => {
    setIsExpanded(true);
    setIsExiting(false);
  }, []);

  // Close the form (with animation)
  const close = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsExpanded(false);
      setIsExiting(false);
    }, animationDuration);
  }, [animationDuration]);

  // Cancel: reset and close
  const handleCancel = useCallback(() => {
    if (formRef.current) {
      formRef.current.reset();
    }
    close();
  }, [close]);

  // Auto-close on successful submit
  useEffect(() => {
    if (fetcher.state === 'idle' && !fetcher.data?.error && formRef.current && isExpanded) {
      const wasJustSubmitted = formRef.current.getAttribute('data-submitted') === 'true';
      if (wasJustSubmitted) {
        formRef.current.reset();
        formRef.current.removeAttribute('data-submitted');
        close();
      }
    }
  }, [fetcher.state, fetcher.data, isExpanded, close]);

  // onSubmit handler to set data-submitted and call user callback
  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.currentTarget.setAttribute('data-submitted', 'true');
      if (options?.onSubmit) options.onSubmit(e);
    },
    [options],
  );

  return {
    isExpanded,
    isExiting,
    expand,
    close,
    handleCancel,
    formRef,
    onSubmit,
  };
}
