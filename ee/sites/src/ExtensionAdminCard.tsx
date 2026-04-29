import { ExtensionAdminCardContent, type ExtensionAdminCardProps } from '@curvenote/scms-core';

function ExtensionAdminCard({ name, extension, record, ExtensionIcon }: ExtensionAdminCardProps) {
  const video = record?.video as { title?: string; url?: string; thumbnail?: string } | undefined;
  const capabilityKeys = ['task', 'routes', 'dataModels', 'workflows', 'navigation', 'video'];
  const recordFiltered =
    record &&
    (Object.fromEntries(
      Object.entries(record).filter(([key]) => !capabilityKeys.includes(key)),
    ) as Record<string, unknown>);

  return (
    <ExtensionAdminCardContent
      name={name}
      capabilities={extension.capabilities}
      record={Object.keys(recordFiltered ?? {}).length > 0 ? recordFiltered : undefined}
      ExtensionIcon={ExtensionIcon}
    >
      {video?.title && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Welcome video</p>
          <p className="text-sm">
            {video.url ? (
              <a
                href={video.url}
                target="_blank"
                rel="noreferrer"
                className="underline text-primary"
              >
                {video.title}
              </a>
            ) : (
              video.title
            )}
          </p>
        </div>
      )}
    </ExtensionAdminCardContent>
  );
}

export default ExtensionAdminCard;
