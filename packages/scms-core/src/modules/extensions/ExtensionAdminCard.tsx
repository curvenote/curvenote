import { dump } from 'js-yaml';
import type { ExtensionAdminCardProps } from './types.js';
import * as ui from '../../components/ui/index.js';

export type { ExtensionAdminCardProps };

const capabilityLabels: Record<string, string> = {
  dataModels: 'Data Models',
  inboundEmail: 'Inbound Email',
  navigation: 'Navigation',
  routes: 'Routes',
  task: 'Dashboard Task',
  workflows: 'Workflows',
  checks: 'Checks',
};

export function ExtensionAdminCardFallback({
  name,
  extension,
  record,
  ExtensionIcon,
}: ExtensionAdminCardProps) {
  return (
    <ExtensionAdminCardContent
      name={name}
      capabilities={extension.capabilities}
      record={record}
      ExtensionIcon={ExtensionIcon}
    />
  );
}

export function ExtensionAdminCardContent({
  name,
  capabilities,
  record,
  ExtensionIcon,
  children,
}: {
  name: string;
  capabilities?: string[];
  ExtensionIcon?: React.ComponentType<{ className?: string }> | undefined;
  record?: Record<string, unknown>;
  /** Optional extra grid items (e.g. extension-specific sections). */
  children?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start md:gap-6">
      <div className="flex gap-3 items-center min-w-0">
        {ExtensionIcon && <ExtensionIcon className="w-6 h-6 shrink-0" />}
        <h2 className="text-xl font-semibold capitalize">{name}</h2>
      </div>
      {capabilities && capabilities.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Capabilities:</p>
          <div className="flex flex-wrap gap-2">
            {capabilities.map((capability) => (
              <ui.Badge key={capability} variant="secondary">
                {capabilityLabels[capability] || capability}
              </ui.Badge>
            ))}
          </div>
        </div>
      )}
      {record && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Config</p>
          <pre className="p-3 rounded-md bg-muted text-sm overflow-auto max-h-64">
            <code className="block whitespace-pre font-mono">{dump(record)}</code>
          </pre>
        </div>
      )}
      {children}
    </div>
  );
}
