import type { Route } from './+types/route';
import { data } from 'react-router';
import { Plus } from 'lucide-react';
import {
  MainWrapper,
  PageFrame,
  ui,
  getBrandingFromMetaMatches,
  joinPageTitle,
} from '@curvenote/scms-core';
import { withAppAdminContext } from '@curvenote/scms-server';
import { EditorProjectsList } from './EditorProjectsList';
import { fetchUserProjects } from './db.server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppAdminContext(args);
  try {
    const { projects, user } = await fetchUserProjects(ctx);
    return {
      projects,
      user,
    };
  } catch (error) {
    console.error('Error fetching projects:', error);
    return data(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch projects',
        projects: [],
      },
      { status: 400 },
    );
  }
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Editor', branding.title) }];
};

export default function Editor({ loaderData }: Route.ComponentProps) {
  const projects = 'projects' in loaderData ? loaderData.projects : [];
  const user = 'user' in loaderData ? loaderData.user : undefined;

  return (
    <MainWrapper>
      <PageFrame
        title="Editor"
        subtitle="Manage your Curvenote projects"
        hasSecondaryNav={false}
        className="max-w-[1600px] space-y-16"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">My Projects</h2>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              View and manage your Curvenote projects
            </p>
          </div>
          <ui.Button asChild>
            <a
              href={`${user?.links.html}?creation_enabled=true`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Project
            </a>
          </ui.Button>
        </div>

        <EditorProjectsList projects={projects} />
      </PageFrame>
    </MainWrapper>
  );
}
