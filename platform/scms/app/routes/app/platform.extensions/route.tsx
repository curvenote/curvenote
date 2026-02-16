import type { Route } from './+types/route';
import { withAppPlatformAdminContext, getPrismaClient } from '@curvenote/scms-server';
import {
  ui,
  primitives,
  PageFrame,
  SectionWithHeading,
  useDeploymentConfig,
  getExtensionIcon,
  sanitizeExtensionAdminConfig,
} from '@curvenote/scms-core';
import { extensions } from '../../../extensions/client';
import { extensions as serverExtensions } from '../../../extensions/server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppPlatformAdminContext(args, { redirectTo: '/app' });
  const prisma = await getPrismaClient();
  const sites = await prisma.site.findMany({
    where: { external: true },
    orderBy: { name: 'asc' },
    include: {
      domains: true,
      submissionKinds: true,
      collections: true,
    },
  });

  const extensionAdminConfigs: Record<string, Record<string, unknown> | undefined> = {};
  const rawExtensions = ctx.$config.app?.extensions as Record<string, Record<string, unknown>> | undefined;
  if (rawExtensions) {
    for (const [id, config] of Object.entries(rawExtensions)) {
      if (!config || typeof config !== 'object') continue;
      const ext = serverExtensions.find((e) => e.id.toLowerCase() === id.toLowerCase());
      let safe: Record<string, unknown> | undefined;
      if (ext?.getSafeAdminConfig) {
        safe = ext.getSafeAdminConfig(config);
      }
      extensionAdminConfigs[id] = safe !== undefined ? sanitizeExtensionAdminConfig(safe) : undefined;
    }
  }

  return { sites, extensionAdminConfigs };
}

const capabilityLabels: Record<string, string> = {
  dataModels: 'Data Models',
  inboundEmail: 'Inbound Email',
  navigation: 'Navigation',
  routes: 'Routes',
  task: 'Dashboard Task',
  workflows: 'Workflows',
  checks: 'Checks',
};

function ExtensionCardBodyFallback({ extension }: { extension: { capabilities: string[] } }) {
  return (
    <div className="space-y-3">
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
  );
}

export default function ExtensionsPage({ loaderData }: Route.ComponentProps) {
  const { sites, extensionAdminConfigs } = loaderData;

  const deploymentConfig = useDeploymentConfig();
  const extensionsConfig = deploymentConfig.extensions ?? {};

  return (
    <PageFrame title="Extensions">
      <SectionWithHeading heading="Configured Extensions">
        <div className="flex flex-col gap-4">
          {Object.entries(extensionsConfig ?? {}).map(([name, extension]) => {
            const ExtensionIcon = getExtensionIcon(extensions, name);
            const clientExt = extensions.find((e) => e.id.toLowerCase() === name.toLowerCase());
            const AdminCardComponent = clientExt?.getExtensionAdminCard?.();
            const safeConfig = extensionAdminConfigs?.[name];

            return (
              <primitives.Card key={name} lift>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    {ExtensionIcon && <ExtensionIcon className="w-6 h-6" />}
                    <h2 className="text-xl font-semibold capitalize">{name}</h2>
                  </div>
                  {AdminCardComponent && safeConfig !== undefined ? (
                    <AdminCardComponent config={safeConfig} />
                  ) : (
                    <ExtensionCardBodyFallback extension={extension} />
                  )}
                </div>
              </primitives.Card>
            );
          })}
        </div>
      </SectionWithHeading>
      <SectionWithHeading heading="External Sites">
        <div className="space-y-4">
          {sites.map((site) => (
            <primitives.Card key={site.id} lift>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold">{site.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{site.description}</p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {site.private ? 'Private' : 'Public'} •{' '}
                    {site.restricted ? 'Restricted' : 'Open'} Access
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Domains</h3>
                    <div className="flex flex-wrap gap-2">
                      {site.domains.map((domain) => (
                        <ui.Badge key={domain.id} variant="default">
                          {domain.hostname}
                        </ui.Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-medium">Default Workflow</h3>
                    <p className="text-sm text-muted-foreground">{site.default_workflow}</p>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-medium">Submission Kinds</h3>
                    <div className="flex flex-wrap gap-2">
                      {site.submissionKinds.map((kind) => {
                        const content = kind.content as { title?: string };
                        return (
                          <ui.Badge key={kind.id} variant="default">
                            {content?.title || kind.name}
                          </ui.Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-medium">Collections</h3>
                    <div className="flex flex-wrap gap-2">
                      {site.collections.map((collection) => {
                        const content = collection.content as { title?: string };
                        return (
                          <ui.Badge key={collection.id} variant="default">
                            {content?.title || collection.name}
                          </ui.Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <details className="mt-6">
                  <summary className="text-sm font-medium cursor-pointer">Site Metadata</summary>
                  <pre className="p-4 mt-2 overflow-auto text-sm rounded-md bg-muted">
                    {JSON.stringify(site.metadata, null, 2)}
                  </pre>
                </details>
              </div>
            </primitives.Card>
          ))}
        </div>
      </SectionWithHeading>
    </PageFrame>
  );
}
