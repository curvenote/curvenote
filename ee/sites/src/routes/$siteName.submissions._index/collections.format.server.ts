import { coerceToObject } from '@curvenote/scms-core';
import type { SiteContext } from '@curvenote/scms-server';

/** Collection filter dropdown — not CollectionSummaryDTO / sites.formatCollectionSummaryDTO. */
export type CollectionFilterOption = {
  id: string;
  name: string;
  content: { title?: string; [key: string]: unknown };
};

export function formatCollectionFilterOptions(ctx: SiteContext): CollectionFilterOption[] {
  return ctx.site.collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    content: coerceToObject(collection.content),
  }));
}
