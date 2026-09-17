import { isValidTagName, toTagName } from '@curvenote/scms-core';

type TagOption = { name: string; label: string };

/** Catalog entries matching the typed query on label or name. */
export function filterTagOptions<T extends TagOption>(catalog: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return catalog;
  }
  return catalog.filter(
    (tag) => tag.label.toLowerCase().includes(needle) || tag.name.includes(needle),
  );
}

/**
 * The `Create "…"` row, or nothing when the typed text is empty, derives an
 * invalid name, or matches a tag that already exists.
 */
export function getCreateTagOption(
  catalog: TagOption[],
  query: string,
): { label: string; name: string } | undefined {
  const label = query.trim();
  if (!label) {
    return undefined;
  }
  const name = toTagName(label);
  if (!isValidTagName(name)) {
    return undefined;
  }
  if (catalog.some((tag) => tag.name === name)) {
    return undefined;
  }
  return { label, name };
}
