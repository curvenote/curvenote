import type { Context } from '../../backend/types.js';
import type { ClientDeploymentConfig } from '../../providers/DeploymentProvider.js';
import type {
  ClientExtension,
  ClientExtensionTimelineItem,
  ExtensionTimelineItemDescriptor,
  ExtensionTimelineItemProps,
  RegisteredExtensionTimelineItem,
  ServerExtension,
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
  definition: ClientExtensionTimelineItem;
  props: ExtensionTimelineItemProps;
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
 * Collect registered timeline item definitions from enabled extensions (client deployment config).
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
 * Collect registered timeline item definitions from enabled extensions (server app config).
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

export type ResolveExtensionTimelineDescriptorsArgs = {
  ctx: Context;
  surface: TimelineSurface;
  workVersions: WorkVersionTimelineSource[];
};

/**
 * Ask each route-enabled server extension for timeline descriptors for the given versions.
 * Host merges results into loader data; no extension-named metadata keys required.
 */
export async function resolveExtensionTimelineDescriptors(
  serverConfig: AppConfig,
  extensions: ServerExtension[],
  args: ResolveExtensionTimelineDescriptorsArgs,
): Promise<ExtensionTimelineItemDescriptor[]> {
  const descriptors: ExtensionTimelineItemDescriptor[] = [];
  for (const ext of extensions) {
    const extCfg = getExtensionConfig(serverConfig, ext.id);
    if (!extensionTimelineEnabledFromServerConfig(extCfg) || !ext.resolveTimelineItems) continue;
    const resolved = await ext.resolveTimelineItems({
      ctx: args.ctx,
      surface: args.surface,
      workVersions: args.workVersions,
    });
    descriptors.push(...resolved);
  }
  return descriptors;
}

function buildWorkVersionTimelineProps(
  workId: string,
  version: WorkVersionTimelineSource,
  surface: TimelineSurface,
  payload?: unknown,
): ExtensionTimelineItemProps {
  return {
    surface,
    workId,
    workVersionId: version.id,
    dateCreated: version.date_created,
    dateModified: version.date_modified,
    draft: version.draft,
    metadata: version.metadata,
    payload,
  };
}

function definitionLookupKey(extensionId: string, itemId: string): string {
  return `${extensionId}:${itemId}`;
}

/**
 * Build timeline entries from server descriptors + client-registered React definitions.
 * Presence in `descriptors` is the visibility source of truth (does not call `isVisible`).
 */
export function buildExtensionTimelineEntriesForWorkVersion(
  workId: string,
  version: WorkVersionTimelineSource,
  registeredItems: RegisteredExtensionTimelineItem[],
  descriptors: ExtensionTimelineItemDescriptor[] = [],
  surface: TimelineSurface = 'work-version',
): BuiltExtensionTimelineEntry[] {
  const definitionsByKey = new Map<string, ClientExtensionTimelineItem>();
  for (const { extensionId, item } of registeredItems) {
    definitionsByKey.set(definitionLookupKey(extensionId, item.id), item);
  }

  const entries: BuiltExtensionTimelineEntry[] = [];

  for (const [index, descriptor] of descriptors.entries()) {
    if (descriptor.workVersionId !== version.id) continue;

    const definition = definitionsByKey.get(
      definitionLookupKey(descriptor.extensionId, descriptor.itemId),
    );
    if (!definition || !definition.surfaces.includes(surface)) continue;

    const props = buildWorkVersionTimelineProps(workId, version, surface, descriptor.payload);
    const descriptorKey = descriptor.id ?? String(index);

    entries.push({
      key: `extension-timeline-${descriptor.extensionId}-${descriptor.itemId}-${version.id}-${descriptorKey}`,
      date: descriptor.sortDate || version.date_modified || version.date_created,
      sortRank: definition.sortRank ?? DEFAULT_TIMELINE_ITEM_SORT_RANK,
      extensionId: descriptor.extensionId,
      definition,
      props,
    });
  }

  return entries;
}
