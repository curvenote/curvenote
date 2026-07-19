import { useEffect, useState } from 'react';

/**
 * Returns `true` once `active` has stayed continuously `true` for `delayMs`.
 * Resets to `false` the moment `active` becomes `false`, so the caller can use
 * it to reveal a delayed escape hatch during a long-running busy state without
 * flashing it on quick operations.
 */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!active) {
      setElapsed(false);
      return;
    }
    setElapsed(false);
    const id = setTimeout(() => setElapsed(true), delayMs);
    return () => clearTimeout(id);
  }, [active, delayMs]);

  return active && elapsed;
}
