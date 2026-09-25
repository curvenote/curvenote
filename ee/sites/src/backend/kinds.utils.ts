type KindForTitle = { name: string; content: unknown };

/** The name people see for a Submission Kind: its content title, else its name. */
export function kindTitle(kind: KindForTitle): string {
  const title = (kind.content as { title?: unknown } | null | undefined)?.title;
  return typeof title === 'string' && title.trim() ? title : kind.name;
}
