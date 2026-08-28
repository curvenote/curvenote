import type {
  ClientExtensionTimelineItem,
  ExtensionTimelineItemProps,
} from '../../modules/extensions/types.js';

type ExtensionTimelineItemRendererProps = {
  definition: ClientExtensionTimelineItem;
  props: ExtensionTimelineItemProps;
};

/**
 * Renders an extension-owned timeline row and optional headless mount component.
 */
export function ExtensionTimelineItemRenderer({
  definition,
  props,
}: ExtensionTimelineItemRendererProps) {
  const Component = definition.component;
  const MountComponent = definition.mountComponent;

  return (
    <>
      {MountComponent != null ? <MountComponent {...props} /> : null}
      <Component {...props} />
    </>
  );
}
