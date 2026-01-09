import type { ClientExtension, IconComponent, IconTag } from './types.js';

export function getExtensionIcon(
  extensions: ClientExtension[],
  extensionId: string,
  tag: IconTag = 'default',
): IconComponent | undefined {
  const extension = extensions.find((ext) => ext.id === extensionId);
  if (!extension) return undefined;

  const icons = extension.getIcons?.() || [];
  return icons.find((icon) => icon.tags?.includes(tag))?.component;
}
