// https://sergiodxa.com/articles/automatic-revalidation-in-remix

import { useNavigate } from 'react-router';
import { useCallback, useEffect } from 'react';

export function useRevalidate() {
  // We get the navigate function from React Rotuer
  const navigate = useNavigate();
  // And return a function which will navigate to `.` (same URL) and replace it
  return useCallback(
    function revalidate() {
      navigate('.', { replace: true, preventScrollReset: true });
    },
    [navigate],
  );
}

export function useRevalidateOnInterval({
  enabled = false,
  interval = 1000,
}: {
  enabled: boolean;
  interval?: number;
}) {
  const revalidate = useRevalidate();
  useEffect(
    function revalidateOnInterval() {
      if (!enabled) return;
      const tId = setInterval(revalidate, interval);
      return function cleanup() {
        clearInterval(tId);
      };
    },
    [revalidate, interval, enabled],
  );
  return revalidate;
}
