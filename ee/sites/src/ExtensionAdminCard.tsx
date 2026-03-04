import type { ExtensionAdminCardProps } from '@curvenote/scms-core';

function ExtensionAdminCard({ config, extensionName, ExtensionIcon }: ExtensionAdminCardProps) {
  const video = config.video as { title?: string; url?: string; thumbnail?: string } | undefined;
  const flags = [
    config.task && 'task',
    config.routes && 'routes',
    config.dataModels && 'dataModels',
    config.workflows && 'workflows',
    config.navigation && 'navigation',
  ].filter(Boolean) as string[];

  return (
    <div className="grid grid-cols-1 gap-4 min-w-0 md:grid-cols-2 md:items-start md:gap-2">
      <div className="flex gap-3 items-center min-w-0">
        {ExtensionIcon && <ExtensionIcon className="w-6 h-6 shrink-0" />}
        <h2 className="text-xl font-semibold capitalize">{extensionName}</h2>
      </div>
      {flags.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Config:</p>
          <div className="flex flex-wrap gap-2">
            {flags.map((key) => (
              <span
                key={key}
                className="rounded-md bg-secondary px-2 py-0.5 text-sm font-medium text-secondary-foreground"
              >
                {key}
              </span>
            ))}
          </div>
        </div>
      )}
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
    </div>
  );
}

export default ExtensionAdminCard;
