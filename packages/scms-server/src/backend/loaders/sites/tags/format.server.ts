import type { TagDTO } from '@curvenote/common';

/** Fields read by {@link formatTagDTO}. */
export type TagRow = { id: string; name: string; label: string };

export function formatTagDTO(row: TagRow): TagDTO {
  return { id: row.id, name: row.name, label: row.label };
}
