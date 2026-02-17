import { ui } from '@curvenote/scms-core';

const capabilityLabels: Record<string, string> = {
  dataModels: 'Data Models',
  inboundEmail: 'Inbound Email',
  navigation: 'Navigation',
  routes: 'Routes',
  task: 'Dashboard Task',
  workflows: 'Workflows',
  checks: 'Checks',
};

export function ExtensionCardBodyFallback({
  name,
  extension,
  ExtensionIcon,
}: {
  name: string;
  extension: { capabilities: string[] };
  ExtensionIcon: React.ComponentType<{ className?: string }> | undefined;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start md:gap-6">
      <div className="flex min-w-0 items-center gap-3">
        {ExtensionIcon && <ExtensionIcon className="h-6 w-6 shrink-0" />}
        <h2 className="text-xl font-semibold capitalize">{name}</h2>
      </div>
      <div className="min-w-0">
        {extension.capabilities.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Capabilities:</p>
            <div className="flex flex-wrap gap-2">
              {extension.capabilities.map((capability) => (
                <ui.Badge key={capability} variant="secondary">
                  {capabilityLabels[capability] || capability}
                </ui.Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No capabilities configured</p>
        )}
      </div>
    </div>
  );
}
