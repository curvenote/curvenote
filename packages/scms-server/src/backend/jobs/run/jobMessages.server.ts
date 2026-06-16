/** Last non-empty job log line (status-only updates may leave blank entries). */
export function lastJobMessage(messages: string[] | null | undefined): string | undefined {
  if (!messages?.length) return undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]?.trim();
    if (msg) return msg;
  }
  return undefined;
}
