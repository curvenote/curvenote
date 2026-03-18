import type { Route } from './+types/route';
import React from 'react';
import { withAppContext, getUserScopesSet } from '@curvenote/scms-server';
import {
  MainWrapper,
  PageFrame,
  cn,
  ui,
  TrackEvent,
  getBrandingFromMetaMatches,
  joinPageTitle,
  useDeploymentConfig,
  ClientOnly,
  getAvailableTasksWithComponents,
  getAvailableScopedTasks,
} from '@curvenote/scms-core';
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

type TaskWithComponent = ReturnType<typeof getAvailableTasksWithComponents>[number];

type RenderTaskSection = {
  title: string;
  tasks: TaskWithComponent[];
};

function sortTasks(tasks: TaskWithComponent[]): TaskWithComponent[] {
  return [...tasks].sort((a, b) => a.id.localeCompare(b.id) || a.name.localeCompare(b.name));
}

function normalizeCategory(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function toTitleCaseCategory(category: string): string {
  return category
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function renderDescriptionWithBoldMarkers(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const markerRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = markerRegex.exec(text)) !== null) {
    const [fullMatch, boldText] = match;
    const matchStart = match.index;
    const matchEnd = matchStart + fullMatch.length;

    if (matchStart > lastIndex) {
      parts.push(text.slice(lastIndex, matchStart));
    }

    parts.push(<strong key={`description-bold-${matchStart}`}>{boldText}</strong>);
    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { taskConfig } = loaderData;
  const deployment = useDeploymentConfig();
  const { title, tagline, description } = deployment.dashboard?.welcome ?? {};
  const welcomeVideos = deployment.dashboard?.welcome?.videos || [];
  const [featuredWelcomeVideo, ...remainingWelcomeVideos] = welcomeVideos;
  const dashboardTasksConfig = deployment.dashboard?.tasks;
  const shouldRenderTasks = dashboardTasksConfig?.enabled === true;

  // Get filtered tasks with components (client-side only, using task config from loader)
  const tasksWithComponents = getAvailableTasksWithComponents(extensions, taskConfig);
  const configuredSections = dashboardTasksConfig?.sections ?? [];

  const tasksByCategory = new Map<string, TaskWithComponent[]>();
  const uncategorizedTasks: TaskWithComponent[] = [];

  for (const task of tasksWithComponents) {
    const category = normalizeCategory(task.category);
    if (!category) {
      uncategorizedTasks.push(task);
      continue;
    }
    const categoryTasks = tasksByCategory.get(category) ?? [];
    categoryTasks.push(task);
    tasksByCategory.set(category, categoryTasks);
  }

  for (const [category, tasks] of tasksByCategory.entries()) {
    tasksByCategory.set(category, sortTasks(tasks));
  }

  const configuredCategories = new Set(
    configuredSections.flatMap((section) =>
      (section.categories ?? [])
        .map((category) => normalizeCategory(category))
        .filter((category): category is string => Boolean(category)),
    ),
  );

  const usedTaskIds = new Set<string>();
  const renderTaskSections: RenderTaskSection[] = [];

  // Render configured sections first, honoring the configured section/category order.
  for (const section of configuredSections) {
    const sectionTasks: TaskWithComponent[] = [];
    for (const rawCategory of section.categories ?? []) {
      const normalizedCategory = normalizeCategory(rawCategory);
      if (!normalizedCategory) continue;
      const categoryTasks = tasksByCategory.get(normalizedCategory) ?? [];
      for (const task of categoryTasks) {
        if (usedTaskIds.has(task.id)) continue;
        usedTaskIds.add(task.id);
        sectionTasks.push(task);
      }
    }

    if (sectionTasks.length > 0) {
      renderTaskSections.push({
        title: section.title,
        tasks: sectionTasks,
      });
    }
  }

  // Then append sections for any task categories that are not declared in config.
  const unmatchedCategories = [...tasksByCategory.keys()]
    .filter((category) => !configuredCategories.has(category))
    .sort((a, b) => a.localeCompare(b));

  for (const category of unmatchedCategories) {
    const categoryTasks = (tasksByCategory.get(category) ?? []).filter((task) => {
      if (usedTaskIds.has(task.id)) return false;
      usedTaskIds.add(task.id);
      return true;
    });

    if (categoryTasks.length > 0) {
      renderTaskSections.push({
        title: toTitleCaseCategory(category),
        tasks: categoryTasks,
      });
    }
  }

  const otherTasks = sortTasks(uncategorizedTasks).filter((task) => {
    if (usedTaskIds.has(task.id)) return false;
    usedTaskIds.add(task.id);
    return true;
  });

  if (otherTasks.length > 0) {
    renderTaskSections.push({
      title: 'Other tasks',
      tasks: otherTasks,
    });
  }

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
            </div>

            {shouldRenderTasks && renderTaskSections.length > 0 && (
              <div className="space-y-10">
                {renderTaskSections.map((section) => (
                  <section key={section.title} className="space-y-4">
                    <h2 className="text-2xl font-light text-blue-900 dark:text-gray-100">
                      {section.title}
                    </h2>
                    <div className={cn('flex flex-wrap gap-4 justify-start items-stretch')}>
                      {section.tasks.map((task) => {
                        const TaskComponent = task.component as React.ComponentType;
                        if (!TaskComponent) {
                          console.warn(`Task component not found for task: ${task.name}`);
                          return null;
                        }
                        return (
                          <div key={task.id} className="flex w-md">
                            <ClientOnly
                              fallback={
                                <div className="h-32 bg-gray-100 rounded animate-pulse w-md" />
                              }
                            >
                              {() => <TaskComponent />}
                            </ClientOnly>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {(description || welcomeVideos.length > 0) && (
              <div className="pt-10 border-t border-gray-200 dark:border-gray-700">
                {(description || featuredWelcomeVideo) && (
                  <div
                    className={cn(
                      'gap-10 mx-auto',
                      description && featuredWelcomeVideo && 'grid lg:grid-cols-2',
                    )}
                  >
                    {description && (
                      <div className="space-y-4 font-light text-muted-foreground">
                        <p className="whitespace-pre-wrap">
                          {renderDescriptionWithBoldMarkers(description)}
                        </p>
                      </div>
                    )}
                    {featuredWelcomeVideo && (
                      <div className={cn(!description && 'mx-auto max-w-4xl')}>
                        <ui.VideoPlayerCard
                          className="h-full"
                          video={featuredWelcomeVideo}
                          playEventType={TrackEvent.WELCOME_VIDEO_PLAYED}
                        />
                      </div>
                    )}
                  </div>
                )}

                {remainingWelcomeVideos.length > 0 && (
                  <div className="grid grid-cols-1 gap-4 mt-8 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {remainingWelcomeVideos.map((video, index) => (
                      <ui.VideoPlayerCard
                        key={`${video.url}-${index + 1}`}
                        video={video}
                        size="compact"
                        playEventType={TrackEvent.WELCOME_VIDEO_PLAYED}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </PageFrame>
      </MainWrapper>
    </>
  );
}
