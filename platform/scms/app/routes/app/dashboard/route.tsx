import type { Route } from './+types/route';
import React from 'react';
import { withAppContext, getUserScopesSet } from '@curvenote/scms-server';
import {
  MainWrapper,
  PageFrame,
  cn,
  getBrandingFromMetaMatches,
  joinPageTitle,
  useDeploymentConfig,
  ClientOnly,
  getAvailableTasksWithComponents,
  getAvailableScopedTasks,
} from '@curvenote/scms-core';
import { WelcomeVideos } from './WelcomeVideos';
import { extensions } from '../../../extensions/client';
import { extensions as serverExtensions } from '../../../extensions/server';
import type { Extensions } from 'types/app-config';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppContext(args);
  const extensionConfigs: Extensions = ctx.$config?.app?.extensions || {};
  const reducedExtensionConfigs = Object.fromEntries(
    Object.entries(extensionConfigs).map(([key, value]) => [key, { task: value.task ?? false }]),
  );

  // Return map of extension IDs to arrays of allowed task IDs
  // Tasks are filtered based on extension config (task: true) and user scopes
  const taskConfig: Record<string, string[]> = getAvailableScopedTasks(
    reducedExtensionConfigs,
    serverExtensions,
    Array.from(getUserScopesSet(ctx.user)), // TODO: We cannot rely on this being on context yet
  );

  return { taskConfig };
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ key: 'title', title: joinPageTitle('Dashboard', branding.title) }];
};

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { taskConfig } = loaderData;
  const deployment = useDeploymentConfig();
  const { title, tagline, description, showTasks } = deployment.branding?.welcome ?? {};
  const welcomeVideos = deployment.branding?.welcome?.videos || [];

  // Get filtered tasks with components (client-side only, using task config from loader)
  const tasksWithComponents = getAvailableTasksWithComponents(extensions, taskConfig);

  return (
    <>
      <MainWrapper>
        <PageFrame hasSecondaryNav={false} className="max-w-[1600px]">
          <div className="space-y-16">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="mb-4 text-4xl font-light text-blue-900 dark:text-gray-100">
                {title ?? 'Welcome to the Curvenote SCMS'}
              </h1>
              <p className="mb-8 text-lg text-gray-600 dark:text-gray-400">
                {tagline ??
                  'Get started with your research workflow using the tools and resources below.'}
              </p>
              {description && <p className="mb-8 text-muted-foreground">{description}</p>}
            </div>

            {showTasks && tasksWithComponents && tasksWithComponents.length > 0 && (
              <div>
                <div className={cn('flex flex-wrap gap-4 justify-center items-stretch')}>
                  {tasksWithComponents.map((task) => {
                    const TaskComponent = task.component as React.ComponentType;
                    if (!TaskComponent) {
                      console.warn(`Task component not found for task: ${task.name}`);
                      return null;
                    }
                    return (
                      <div key={task.id} className="flex w-md">
                        <ClientOnly
                          fallback={<div className="h-32 bg-gray-100 rounded animate-pulse w-md" />}
                        >
                          {() => <TaskComponent />}
                        </ClientOnly>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {welcomeVideos.length > 0 && (
              <div className="mx-auto max-w-4xl">
                <WelcomeVideos videos={welcomeVideos} />
              </div>
            )}
          </div>
        </PageFrame>
      </MainWrapper>
    </>
  );
}
