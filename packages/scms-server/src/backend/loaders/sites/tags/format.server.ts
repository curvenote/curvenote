import type { TagDTO, TagRefDTO } from '@curvenote/common';

/** Fields read by {@link formatTagDTO}. */
export type TagRow = { id: string; name: string; label: string };

/**
 * Catalog page row. Not a DTO — `date_created` and `submission_count` must not
 * leak onto `SiteDTO.tags`.
 */
export type TagCatalogRow = TagRow & { date_created: string; submission_count: number };

export function formatTagDTO(row: TagRow): TagDTO {
  return { id: row.id, name: row.name, label: row.label };
}

/**
 * A tag without its catalog `id`, for payloads read by external consumers.
 * They key on `name`, which is unique per site and URL-safe; `id` is only
 * needed by the admin write path, which reads the catalog directly.
 */
export function formatTagRefDTO(row: Omit<TagRow, 'id'>): TagRefDTO {
  return { name: row.name, label: row.label };
}
