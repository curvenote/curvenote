import { useEffect, useState } from 'react';
import { BUSY_MESSAGE_INTERVAL_MS } from './busyMessages';

/**
 * Cycle through `messages` on a fixed cadence while `active`, resetting to the first
 * message whenever it becomes inactive. Returns the message to display now.
 */
export function useRotatingMessage(
  messages: readonly string[],
  active: boolean,
  intervalMs = BUSY_MESSAGE_INTERVAL_MS,
): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const id = setInterval(() => {
      setIndex((curr) => (curr + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, messages.length]);
  return messages[index] ?? messages[0];
}
