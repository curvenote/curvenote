import {
  getExtensionIcon,
  ExtensionAdminCardFallback,
  type ClientExtension,
} from '@curvenote/scms-core';

type ExtensionMeta = {
  name: string;
  capabilities: string[];
};

type Props = {
  extensionId: string;
  extension: ExtensionMeta;
  safeConfig: Record<string, unknown> | undefined;
  clientExtensions: ClientExtension[];
};

export function ExtensionAdminTabContent({
  extensionId,
  extension,
  safeConfig,
  clientExtensions,
}: Props) {
  const ExtensionIcon = getExtensionIcon(clientExtensions, extensionId);
  const clientExt = clientExtensions.find((e) => e.id.toLowerCase() === extensionId.toLowerCase());
  const AdminCardComponent = clientExt?.getExtensionAdminCard?.();

  if (safeConfig === undefined) {
    return (
      <p className="text-sm text-muted-foreground">
        No admin configuration is available for this extension.
      </p>
    );
  }

  if (AdminCardComponent) {
    return (
      <AdminCardComponent
        name={extensionId}
        extension={extension}
        record={safeConfig}
        ExtensionIcon={ExtensionIcon}
      />
    );
  }

  return (
    <ExtensionAdminCardFallback
      name={extensionId}
      extension={extension}
      record={safeConfig}
      ExtensionIcon={ExtensionIcon}
    />
  );
}
