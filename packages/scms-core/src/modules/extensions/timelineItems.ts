import type { ClientDeploymentConfig } from '../../providers/DeploymentProvider.js';
import type {
  ClientExtension,
  ClientExtensionTimelineItem,
  ExtensionTimelineItemContext,
  RegisteredExtensionTimelineItem,
  TimelineSurface,
} from './types.js';
import { getExtensionConfig } from './utils.js';

const DEFAULT_TIMELINE_ITEM_SORT_RANK = 50;

export type WorkVersionTimelineSource = {
  id: string;
  work_id: string;
  date_created: string;
  date_modified: string;
  draft: boolean;
  metadata: unknown;
};

export type BuiltExtensionTimelineEntry = {
  key: string;
  date: string;
  sortRank: number;
  extensionId: string;
  item: ClientExtensionTimelineItem;
  ctx: ExtensionTimelineItemContext;
};

/**
 * Whether an extension exposes timeline items in app config (server).
 * Aligned with work-create options and route registration (`routes === true`).
 */
export function extensionTimelineEnabledFromServerConfig(
  extCfg: { routes?: boolean } | undefined,
): boolean {
  return extCfg?.routes === true;
}

/**
 * Whether an extension exposes timeline items in client deployment config.
 */
export function extensionTimelineEnabledFromClientConfig(
  extCfg: { capabilities: string[] } | undefined,
): boolean {
  return extCfg?.capabilities?.includes('routes') === true;
}

/**
 * Collect registered timeline items from enabled extensions (client deployment config).
 */
export function getExtensionTimelineItemsFromClientConfig(
  clientConfig: ClientDeploymentConfig,
  extensions: ClientExtension[],
): RegisteredExtensionTimelineItem[] {
  const items: RegisteredExtensionTimelineItem[] = [];
  for (const ext of extensions) {
    const extCfg = clientConfig.extensions?.[ext.id];
    if (!extensionTimelineEnabledFromClientConfig(extCfg) || !ext.getTimelineItems) continue;
    for (const item of ext.getTimelineItems()) {
      items.push({ extensionId: ext.id, item });
    }
  }
  return items;
}

/**
 * Collect registered timeline items from enabled extensions (server app config).
 */
export function getExtensionTimelineItemsFromServerConfig(
  serverConfig: AppConfig,
  extensions: ClientExtension[],
): RegisteredExtensionTimelineItem[] {
  const items: RegisteredExtensionTimelineItem[] = [];
  for (const ext of extensions) {
    const extCfg = getExtensionConfig(serverConfig, ext.id);
    if (!extensionTimelineEnabledFromServerConfig(extCfg) || !ext.getTimelineItems) continue;
    for (const item of ext.getTimelineItems()) {
      items.push({ extensionId: ext.id, item });
    }
  }
  return items;
}

function buildWorkVersionTimelineContext(
  workId: string,
  version: WorkVersionTimelineSource,
  payload?: unknown,
): ExtensionTimelineItemContext {
  return {
    surface: 'work-version',
    workId,
    workVersionId: version.id,
    dateCreated: version.date_created,
    dateModified: version.date_modified,
    draft: version.draft,
    metadata: version.metadata,
    payload,
  };
}

/**
 * Build visible extension timeline entries for one work-version section.
 */
export function buildExtensionTimelineEntriesForWorkVersion(
  workId: string,
  version: WorkVersionTimelineSource,
  registeredItems: RegisteredExtensionTimelineItem[],
  surface: TimelineSurface = 'work-version',
  payloadsByKey: Record<string, unknown> = {},
): BuiltExtensionTimelineEntry[] {
  const entries: BuiltExtensionTimelineEntry[] = [];

  for (const { extensionId, item } of registeredItems) {
    if (!item.surfaces.includes(surface)) continue;

    const payloadKey = `${extensionId}:${item.id}:${version.id}`;
    const ctx = buildWorkVersionTimelineContext(workId, version, payloadsByKey[payloadKey]);

    if (!item.isVisible(ctx)) continue;

    entries.push({
      key: `extension-timeline-${extensionId}-${item.id}-${version.id}`,
      date: version.date_modified || version.date_created,
      sortRank: item.sortRank ?? DEFAULT_TIMELINE_ITEM_SORT_RANK,
      extensionId,
      item,
      ctx,
    });
  }

  return entries;
}
