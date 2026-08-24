import type {
  ClientExtensionTimelineItem,
  ExtensionTimelineItemContext,
} from '../../modules/extensions/types.js';

type ExtensionTimelineItemRendererProps = {
  item: ClientExtensionTimelineItem;
  ctx: ExtensionTimelineItemContext;
};

/**
 * Renders an extension-owned timeline row and optional headless mount component.
 */
export function ExtensionTimelineItemRenderer({ item, ctx }: ExtensionTimelineItemRendererProps) {
  const Component = item.component;
  const MountComponent = item.mountComponent;

  return (
    <>
      {MountComponent != null ? <MountComponent {...ctx} /> : null}
      <Component {...ctx} />
    </>
  );
}
