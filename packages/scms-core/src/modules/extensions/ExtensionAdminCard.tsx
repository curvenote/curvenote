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

function isUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^https?:\/\//i.test(value.trim());
}

function formatRecordValue(value: unknown): React.ReactNode {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  const str = String(value);
  if (isUrl(str)) {
    return (
      <a href={str} target="_blank" rel="noreferrer" className="underline break-all text-primary">
        {str}
      </a>
    );
  }
  return str;
}

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
      {record &&
        Object.entries(record)
          .filter(
            ([key]) =>
              !(capabilities?.includes(key) || key in capabilityLabels),
          )
          .map(([key, value]) => (
            <div key={key} className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{key}</p>
              <p className="text-sm text-foreground">{formatRecordValue(value)}</p>
            </div>
          ))}
      {children}
    </div>
  );
}
