import type { Context } from '@curvenote/scms-core';
import { error401 } from '@curvenote/scms-core';
import { createSessionToken } from '@curvenote/scms-server';

export type EditorProject = {
  id: string;
  name: string;
  date_created: string;
  date_modified: string;
  links: {
    self: string;
    html: string;
  };
};

export type EditorUser = {
  links: {
    html: string;
  };
};

export type UserProjects = {
  projects: EditorProject[];
  user: EditorUser;
};

export async function fetchUserProjects(ctx: Context): Promise<UserProjects> {
  if (!ctx.user) {
    throw error401('User not authenticated');
  }

  const token = createSessionToken(
    ctx.user,
    ctx.$config.api.sessionTokenAudience,
    ctx.$config.api.sessionTokenIssuer,
    'Editor API Token',
    ctx.$config.api.tokenConfigUrl,
    ctx.$config.api.jwtSigningSecret,
  );

  const editorApiUrl = ctx.$config.api.editorApiUrl;
  const [projectsResponse, userResponse] = await Promise.all([
    fetch(`${editorApiUrl}/my/projects`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }),
    fetch(`${editorApiUrl}/my/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }),
  ]);

  if (!projectsResponse.ok) {
    console.error(
      'Failed to fetch projects from editor API:',
      projectsResponse.status,
      projectsResponse.statusText,
    );
    throw new Error(
      `Failed to fetch projects: ${projectsResponse.status} ${projectsResponse.statusText}`,
    );
  }

  if (!userResponse.ok) {
    console.error(
      'Failed to fetch user from editor API:',
      userResponse.status,
      userResponse.statusText,
    );
    throw new Error(`Failed to fetch user: ${userResponse.status} ${userResponse.statusText}`);
  }

  const { items: projects } = await projectsResponse.json();
  const user = await userResponse.json();
  return { projects, user };
}
