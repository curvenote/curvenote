import type { TagDTO } from '@curvenote/common';
import { isValidTagName, toTagName } from '@curvenote/scms-core';

/** Catalog entries matching the typed query on label or name. */
export function filterTagOptions(catalog: TagDTO[], query: string): TagDTO[] {
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
  catalog: TagDTO[],
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
