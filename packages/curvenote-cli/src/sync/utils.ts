import chalk from 'chalk';
import path from 'node:path';
import { uuidv7 } from 'uuidv7';
import type { ProjectConfig, SiteConfig, SiteProject } from 'myst-config';
import { getGithubUrl } from 'myst-cli';
import { docLinks } from '../docs.js';
import { Project, RemoteSiteConfig } from '../models.js';
import type { ISession } from '../session/types.js';
import type { SyncCiHelperOptions } from './types.js';
import { oxaLinkToId } from '@curvenote/blocks';
import { getFromJournals } from '../utils/api.js';
import CurvenoteVersion from '../version.js';

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
    id: uuidv7(),
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

/**
 * Normalize GitHub URL to HTTPS clone URL
 * Handles formats:
 * - https://github.com/user/repo
 * - https://github.com/user/repo.git
 * - git@github.com:user/repo.git
 * - github.com/user/repo
 * - user/repo
 */
export function normalizeGithubUrl(url: string): string {
  let normalized = url.trim();

  // Convert SSH format to HTTPS
  if (normalized.startsWith('git@github.com:')) {
    normalized = normalized.replace('git@github.com:', 'https://github.com/');
  }

  // Ensure HTTPS protocol
  if (!normalized.startsWith('http')) {
    normalized = 'https://github.com/' + normalized.replace(/^github\.com\//, '');
  }

  // Ensure .git extension for cloning
  if (!normalized.endsWith('.git')) {
    normalized = normalized + '.git';
  }

  return normalized;
}

/**
 * Generate a new work key (UUID) and validate it against the API to ensure it's available.
 * Retries up to 3 times if the key is already taken.
 *
 * @param session - The session object for API calls
 * @returns A validated work key that is available
 * @throws Error if all retry attempts fail, including Node.js version, Curvenote version, and support contact info
 */
export async function generateNewValidatedWorkKey(session: ISession): Promise<string> {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const newKey = uuidv7();
    session.log.debug(`Generated work key (attempt ${attempt}/${MAX_RETRIES}): ${newKey}`);

    try {
      const { exists } = await getFromJournals(session, `/works/key/${newKey}`);
      if (!exists) {
        session.log.debug(`Work key validated and available: ${newKey}`);
        return newKey;
      }
      session.log.debug(`Work key already exists, retrying...`);
    } catch (error) {
      // If the API call fails, we'll retry with a new key
      session.log.debug(`Key validation failed, retrying: ${(error as Error).message}`);
    }
  }

  // All retries exhausted - throw error with diagnostic information
  const nodeVersion = process.version;
  const errorMessage = `Failed to generate a unique work key after ${MAX_RETRIES} attempts.

This is an unexpected error that may indicate an issue with UUID generation or API connectivity.

Diagnostic Information:
  - Node.js version: ${nodeVersion}
  - Curvenote version: ${CurvenoteVersion}

Please contact support@curvenote.com for assistance.`;

  throw new Error(errorMessage);
}

/**
 * Clean author/contributor objects by removing computed or internal fields
 * that shouldn't be persisted to the config file (id, nameParsed)
 */
function cleanContributors(contributors: any[] | undefined): any[] | undefined {
  if (!contributors || !Array.isArray(contributors)) return contributors;

  return contributors.map((contributor) => {
    if (!contributor || typeof contributor !== 'object') return contributor;

    // Create a shallow copy and remove unwanted fields
    const { id, nameParsed, ...cleaned } = contributor;

    return cleaned;
  });
}

/**
 * Prepare project config for writing by removing computed/internal fields
 * This makes the YAML more compact and readable
 */
export function cleanProjectConfigForWrite(projectConfig: ProjectConfig): ProjectConfig {
  const result: any = { ...projectConfig };

  // Clean authors (remove id and nameParsed)
  if (result.authors) {
    result.authors = cleanContributors(result.authors);
  }

  // Clean contributors (remove id and nameParsed)
  if (result.contributors) {
    result.contributors = cleanContributors(result.contributors);
  }

  return result;
}
