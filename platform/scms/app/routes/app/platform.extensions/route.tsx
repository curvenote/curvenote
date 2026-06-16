import type { Route } from './+types/route';
import { withAppPlatformAdminContext, getPrismaClient } from '@curvenote/scms-server';
import {
  PageFrame,
  ui,
  useDeploymentConfig,
  sanitizeExtensionAdminConfig,
} from '@curvenote/scms-core';
import { extensions } from '../../../extensions/client';
import { extensions as serverExtensions } from '../../../extensions/server';
import { data } from 'react-router';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { ExtensionAdminTabContent } from './ExtensionAdminTabContent';
import { ExternalSitesTab } from './ExternalSitesTab';

const EXTERNAL_SITES_TAB = 'external-sites';

const extensionActionSchema = zfd.formData({
  intent: zfd.text(z.string().min(1, 'Intent is required')),
});

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
  const rawExtensions = ctx.$config.app?.extensions as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (rawExtensions) {
    for (const [id, config] of Object.entries(rawExtensions)) {
      if (!config || typeof config !== 'object') continue;
      const ext = serverExtensions.find((e) => e.id.toLowerCase() === id.toLowerCase());
      const rawConfig = ext?.getExtensionConfiguration
        ? await ext.getExtensionConfiguration(ctx)
        : config;
      let safe: Record<string, unknown> | undefined;
      if (rawConfig != null && ext?.getSafeAdminConfig) {
        safe = ext.getSafeAdminConfig(rawConfig);
      }
      extensionAdminConfigs[id] =
        safe !== undefined ? sanitizeExtensionAdminConfig(safe) : undefined;
    }
  }

  return { sites, extensionAdminConfigs };
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppPlatformAdminContext(args, { redirectTo: '/app' });

  const formData = await args.request.formData();
  const parsed = extensionActionSchema.safeParse(formData);
  if (!parsed.success) {
    const message =
      parsed.error.issues.map((issue: { message: string }) => issue.message).join('; ') ||
      'Invalid form data';
    return data({ error: { type: 'general', message } }, { status: 400 });
  }
  const { intent } = parsed.data;

  const actionHandlers = serverExtensions.flatMap(
    (e) => e.getExtensionAdminActionHandlers?.() ?? [],
  );
  const actionHandler = actionHandlers.find((h) => h.name === intent);
  if (actionHandler) {
    return actionHandler.handler(ctx, formData);
  }
  return data({ error: { type: 'general', message: 'Unknown intent' } }, { status: 400 });
}

function getExtensionTabLabel(extensionId: string): string {
  const clientExt = extensions.find((e) => e.id.toLowerCase() === extensionId.toLowerCase());
  return clientExt?.name ?? extensionId;
}

export default function ExtensionsPage({ loaderData }: Route.ComponentProps) {
  const { sites, extensionAdminConfigs } = loaderData;

  const deploymentConfig = useDeploymentConfig();
  const extensionsConfig = deploymentConfig.extensions ?? {};
  const extensionEntries = Object.entries(extensionsConfig);
  const defaultTab = extensionEntries[0]?.[0] ?? EXTERNAL_SITES_TAB;

  return (
    <PageFrame
      title="Extensions"
      subtitle="Manage extension configuration and external publishing sites"
      className="mx-auto max-w-screen-lg"
    >
      <ui.Tabs defaultValue={defaultTab} className="space-y-2">
        <ui.TabsList>
          {extensionEntries.map(([extensionId]) => (
            <ui.TabsTrigger key={extensionId} value={extensionId}>
              {getExtensionTabLabel(extensionId)}
            </ui.TabsTrigger>
          ))}
          <ui.TabsTrigger value={EXTERNAL_SITES_TAB}>External Sites</ui.TabsTrigger>
        </ui.TabsList>

        {extensionEntries.map(([extensionId, extension]) => (
          <ui.TabsContent key={extensionId} value={extensionId} className="space-y-2">
            <ExtensionAdminTabContent
              extensionId={extensionId}
              extension={extension}
              safeConfig={extensionAdminConfigs?.[extensionId]}
              clientExtensions={extensions}
            />
          </ui.TabsContent>
        ))}

        <ui.TabsContent value={EXTERNAL_SITES_TAB} className="space-y-2">
          <ExternalSitesTab sites={sites} />
        </ui.TabsContent>
      </ui.Tabs>
    </PageFrame>
  );
}
