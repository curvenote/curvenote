import type { Route } from './+types/route';
import { withAppContext } from '@curvenote/scms-server';
import {
  MainWrapper,
  PageFrame,
  cn,
  getBrandingFromMetaMatches,
  joinPageTitle,
  useDeploymentConfig,
  ClientOnly,
  getAvailableTasksWithComponents,
  getAvailableTasks,
} from '@curvenote/scms-core';
import { WelcomeVideos } from './WelcomeVideos';
import { extensions } from '../../../extensions/client';

export async function loader(args: Route.LoaderArgs) {
  await withAppContext(args);
  const tasks = getAvailableTasks(extensions);
  return { tasks };
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ key: 'title', title: joinPageTitle('Dashboard', branding.title) }];
};

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { tasks } = loaderData;
  const deployment = useDeploymentConfig();
  const { title, tagline, description, showTasks } = deployment.branding?.welcome ?? {};
  const welcomeVideos = deployment.branding?.welcome?.videos || [];

  return (
    <>
      <MainWrapper>
        <PageFrame hasSecondaryNav={false} className="max-w-[1600px]">
          <div className="space-y-16">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="mb-4 text-4xl font-light text-blue-900 dark:text-gray-100">
                {title ?? 'Welcome to the Curvenote SCMS'}
              </h1>
              <p className="mb-8 text-lg text-gray-600 dark:text-gray-400">
                {tagline ??
                  'Get started with your research workflow using the tools and resources below.'}
              </p>
              {description && <p className="mb-8 text-muted-foreground">{description}</p>}
            </div>

            {showTasks && tasks && tasks.length > 0 && (
              <div>
                <div className={cn('flex flex-wrap gap-4 justify-center items-stretch')}>
                  {getAvailableTasksWithComponents(extensions).map((task) => {
                    const Component = task.component;
                    if (!Component) {
                      console.warn(`Task component not found for task: ${task.name}`);
                      return null;
                    }
                    return (
                      <div key={task.name} className="flex w-md">
                        <ClientOnly
                          fallback={<div className="h-32 bg-gray-100 rounded w-md animate-pulse" />}
                        >
                          {() => <Component />}
                        </ClientOnly>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {welcomeVideos.length > 0 && (
              <div className="max-w-4xl mx-auto">
                <WelcomeVideos videos={welcomeVideos} />
              </div>
            )}
          </div>
        </PageFrame>
      </MainWrapper>
    </>
  );
}
