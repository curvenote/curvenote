import chalk from 'chalk';
import path from 'node:path';
import { v4 as uuid } from 'uuid';
import type { ProjectConfig, SiteConfig, SiteProject } from 'myst-config';
import { getGithubUrl } from 'myst-cli';
import { docLinks } from '../docs.js';
import { Project, RemoteSiteConfig } from '../models.js';
import type { ISession } from '../session/types.js';
import type { SyncCiHelperOptions } from './types.js';
import { oxaLinkToId } from '@curvenote/blocks';

export function projectLogString(project: Project) {
  return `"${project.data.title}" (@${project.data.team}/${project.data.name})`;
}

export const INIT_LOGO_PATH = path.join('public', 'logo.svg');

export function getDefaultSiteConfig(title?: string): SiteConfig {
  return {
    title: title || 'My Curve Space',
    domains: [],
    options: { logo: INIT_LOGO_PATH, logo_text: title || 'My Curve Space' },
    nav: [],
    actions: [{ title: 'Learn More', url: docLinks.web }],
  };
}

export async function getDefaultSiteConfigFromRemote(
  session: ISession,
  projectId: string,
  siteProject: SiteProject,
): Promise<SiteConfig> {
  const project = await new Project(session, projectId).get();
  const remoteSiteConfig = await new RemoteSiteConfig(session, project.id).get();
  const siteConfig = getDefaultSiteConfig();
  siteConfig.title = project.data.title;
  siteConfig.options = { logo_text: project.data.title };
  if (remoteSiteConfig.data.domains) siteConfig.domains = remoteSiteConfig.data.domains;
  // Add an entry to the nav if it doesn't exist (i.e. empty list is fine)
  if (!remoteSiteConfig.data.nav) {
    siteConfig.nav = [{ title: project.data.title || '', url: `/${siteProject.slug}` }];
  }
  return siteConfig;
}

export async function getDefaultProjectConfig(title?: string): Promise<ProjectConfig> {
  const github = await getGithubUrl();
  return {
    id: uuid(),
    title: title || 'my-project',
    github,
  };
}

const knownServices = new Set(['blocks', 'drafts', 'projects']);

export function projectIdFromLink(session: ISession, link: string) {
  const id = oxaLinkToId(link);
  if (id) {
    return id.block.project;
  }
  if (link.startsWith('@') && link.split('/').length === 2) {
    // This is something, maybe, of the form @team/project
    return link.replace('/', ':');
  }
  if (link.startsWith(session.config.editorApiUrl)) {
    const [service, project] = link.split('/').slice(3); // https://api.curvenote.com/{service}/{maybeProjectId}
    if (!knownServices.has(service)) throw new Error('Unknown API URL for project.');
    return project;
  }
  if (link.startsWith(session.config.editorUrl)) {
    const [team, project] = link.split('/').slice(-2);
    return `${team}:${project}`;
  }
  return link;
}

export async function validateLinkIsAProject(
  session: ISession,
  projectLink: string,
): Promise<Project | undefined> {
  const id = projectIdFromLink(session, projectLink);
  let project: Project;
  try {
    project = await new Project(session, id).get();
  } catch (error) {
    session.log.error('Could not load project from link.');
    if (session.isAnon) {
      session.log.info(
        `To add your own Curvenote projects, please authenticate using:\n\ncurvenote token set [token]\n\nLearn more at ${docLinks.auth}`,
      );
    }
    return undefined;
  }
  session.log.info(chalk.green(`🔍 Found ${projectLogString(project)}`));
  return project;
}

export function processOption(opts: SyncCiHelperOptions | undefined) {
  if (!opts) return undefined;
  return {
    ...opts,
    yes: opts.ci || opts.yes,
  };
}
