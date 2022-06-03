import fs from 'fs';
import { extname, parse, join, sep } from 'path';
import { CURVENOTE_YML, SiteProject, SiteAction, SiteAnalytics } from '../config/types';
import { JupyterBookChapter, readTOC } from '../export/jupyter-book/toc';
import { PROJECT_FRONTMATTER_KEYS, SITE_FRONTMATTER_KEYS } from '../frontmatter/validators';
import { ISession } from '../session/types';
import { RootState, selectors } from '../store';
import { projects } from '../store/local';
import { publicPath, warnOnUnrecognizedKeys } from '../utils';
import { fillMissingKeys } from '../utils/validators';
import {
  SiteManifest,
  pageLevels,
  LocalProjectFolder,
  LocalProjectPage,
  LocalProject,
  ManifestProject,
} from './types';

const DEFAULT_INDEX_FILENAMES = ['index', 'readme'];
const VALID_FILE_EXTENSIONS = ['.md', '.ipynb'];

const tocFile = (path: string): string => join(path, '_toc.yml');

type PageSlugs = Record<string, number>;

function isValidFile(file: string): boolean {
  return VALID_FILE_EXTENSIONS.includes(extname(file).toLowerCase());
}

function resolveExtension(file: string): string | undefined {
  if (fs.existsSync(file)) return file;
  const extensions = VALID_FILE_EXTENSIONS.concat(
    VALID_FILE_EXTENSIONS.map((ext) => ext.toUpperCase()),
  );
  return extensions.map((ext) => `${file}${ext}`).find((fileExt) => fs.existsSync(fileExt));
}

export function isDirectory(file: string): boolean {
  return fs.lstatSync(file).isDirectory();
}

function fileInfo(file: string, pageSlugs: PageSlugs): { slug: string; title: string } {
  let slug = parse(file).name.toLowerCase();
  const title = slug;
  if (pageSlugs[slug]) {
    pageSlugs[slug] += 1;
    slug = `${slug}-${pageSlugs[slug] - 1}`;
  } else {
    pageSlugs[slug] = 1;
  }
  return { slug, title };
}

function getCitationPaths(session: ISession, path: string): string[] {
  // TODO: traverse to find all bibs, and or read from toc/config
  const ref = join(path, 'references.bib');
  if (!fs.existsSync(ref)) {
    session.log.debug(`Expected citations at "${ref}"`);
    return [];
  }
  return [ref];
}

function chaptersToPages(
  path: string,
  chapters: JupyterBookChapter[],
  pages: (LocalProjectFolder | LocalProjectPage)[] = [],
  level: pageLevels = 1,
  pageSlugs: PageSlugs,
): (LocalProjectFolder | LocalProjectPage)[] {
  chapters.forEach((chapter) => {
    // Note: the title will get updated when the file is processed
    const file = resolveExtension(join(path, chapter.file));
    if (!file) {
      throw Error(`File from ${tocFile(path)} not found: ${chapter.file}`);
    }
    pages.push({ file, level, ...fileInfo(file, pageSlugs) });
    const newLevel = level < 5 ? level + 1 : 6;
    if (chapter.sections) {
      chaptersToPages(path, chapter.sections, pages, newLevel as pageLevels, pageSlugs);
    }
  });
  return pages;
}

/**
 * Build project structure from jupyterbook '_toc.yml' file
 */
export function projectFromToc(session: ISession, path: string): LocalProject {
  const filename = tocFile(path);
  if (!fs.existsSync(filename)) {
    throw new Error(`Could not find TOC "${filename}". Please create a '_toc.yml'.`);
  }
  const toc = readTOC(session, { filename });
  const pageSlugs: PageSlugs = {};
  const indexFile = resolveExtension(join(path, toc.root));
  if (!indexFile) {
    throw Error(`Root from ${tocFile(path)} not found: ${indexFile}`);
  }
  const { slug } = fileInfo(indexFile, pageSlugs);
  const pages: (LocalProjectFolder | LocalProjectPage)[] = [];
  if (toc.chapters) {
    chaptersToPages(path, toc.chapters, pages, 1, pageSlugs);
  } else if (toc.parts) {
    toc.parts.forEach((part, index) => {
      if (part.caption) {
        pages.push({ title: part.caption || `Part ${index + 1}`, level: 1 });
      }
      if (part.chapters) {
        chaptersToPages(path, part.chapters, pages, 2, pageSlugs);
      }
    });
  }
  const citations = getCitationPaths(session, path);
  return { path, file: indexFile, index: slug, pages, citations };
}

function projectPagesFromPath(
  path: string,
  level: pageLevels,
  pageSlugs: PageSlugs,
  ignore?: string[],
): (LocalProjectFolder | LocalProjectPage)[] {
  return fs
    .readdirSync(path)
    .map((file) => join(path, file))
    .filter((file) => !ignore || !ignore.includes(file))
    .filter((file) => isValidFile(file) || isDirectory(file))
    .sort()
    .map((file) => {
      if (isValidFile(file)) {
        return {
          file,
          level,
          slug: fileInfo(file, pageSlugs).slug,
        } as LocalProjectPage;
      }
      const projectFolder: LocalProjectFolder = { title: fileInfo(file, pageSlugs).title, level };
      const newLevel = level < 5 ? level + 1 : 6;
      const pages = projectPagesFromPath(file, newLevel as pageLevels, pageSlugs, ignore);
      return pages.length ? [projectFolder, ...pages] : [];
    })
    .flat();
}

/**
 * Pick index file from project pages
 *
 * If "{path}/index.md" or "{path}/readme.md" exist, use that. Otherwise, use the first
 * markdown file. Otherwise, use the first file of any type.
 */
function indexFileFromPages(pages: (LocalProjectFolder | LocalProjectPage)[], path: string) {
  let indexFile: string | undefined;
  const files = pages
    .filter((page): page is LocalProjectPage => 'file' in page)
    .map((page) => page.file);

  const matcher = (ext: string) => {
    // Find default index file with given extension "ext" in "files" list
    let match: string | undefined;
    DEFAULT_INDEX_FILENAMES.map((index) => `${index}${ext}`)
      .map((index) => join(path, index).toLowerCase())
      .forEach((index) => {
        if (match) return;
        files.forEach((file) => {
          if (file.toLowerCase() === index) match = file;
        });
      });
    return match;
  };

  if (!indexFile) indexFile = matcher('.md');
  if (!indexFile) [indexFile] = files.filter((file) => extname(file) === '.md');
  if (!indexFile) indexFile = matcher('.ipynb');
  if (!indexFile) [indexFile] = files;
  return indexFile;
}

/**
 * Build project structure from local file/folder structure.
 */
export function projectFromPath(session: ISession, path: string, indexFile?: string): LocalProject {
  const ext_string = VALID_FILE_EXTENSIONS.join(' or ');
  if (indexFile) {
    if (!isValidFile(indexFile))
      throw Error(`Index file ${indexFile} has invalid extension; must be ${ext_string}}`);
    if (!fs.existsSync(indexFile)) throw Error(`Index file ${indexFile} not found`);
  }
  if (!indexFile) {
    const searchPages = projectPagesFromPath(path, 1, {}, [join(path, '_build')]);
    if (!searchPages.length) {
      throw Error(`No valid files with extensions ${ext_string} found in path "${path}"`);
    }
    indexFile = indexFileFromPages(searchPages, path);
    if (!indexFile) throw Error(`Unable to find any index file in path "${path}"`);
  }
  const pageSlugs: PageSlugs = {};
  const { slug } = fileInfo(indexFile, pageSlugs);
  const pages = projectPagesFromPath(path, 1, pageSlugs, [indexFile, join(path, '_build')]);
  const citations = getCitationPaths(session, path);
  return { file: indexFile, index: slug, path, pages, citations };
}

/**
 * Load project structure from disk from
 *
 * @param session
 * @param path - root directory of project, relative to current directory; default is '.'
 * @param index - index file, including path relative to current directory; default is 'index.md'
 *     or 'readme.md' in 'path' directory
 *
 * If jupyterbook '_toc.yml' exists in path, project structure will be derived from that.
 * In this case, index will be ignored in favor of root from '_toc.yml'
 * If '_toc.yml' does not exist, project structure will be built from the local file/foler structure.
 */
export function loadProjectFromDisk(
  session: ISession,
  path?: string,
  index?: string,
): LocalProject {
  path = path || '.';
  let newProject;
  if (fs.existsSync(tocFile(path))) {
    newProject = projectFromToc(session, path);
  } else {
    const project = selectors.selectLocalProject(session.store.getState(), path);
    if (!index && project?.file) {
      index = project.file;
    }
    newProject = projectFromPath(session, path, index);
  }
  if (!newProject) {
    throw new Error(`Could load project from ${path}`);
  }
  session.store.dispatch(projects.actions.receive(newProject));
  return newProject;
}

/**
 * Convert local project representation to site manifest project
 *
 * This does a couple things:
 * - Adds projectSlug (which locally comes from site config)
 * - Removes any local file references
 * - Adds validated frontmatter
 */
export function localToManifestProject(
  session: ISession,
  state: RootState,
  siteProj: SiteProject,
): ManifestProject | null {
  const projConfig = selectors.selectLocalProjectConfig(state, siteProj.path);
  const proj = selectors.selectLocalProject(state, siteProj.path);
  if (!proj || !projConfig) return null;
  // Update all of the page title to the frontmatter title
  const { index } = proj;
  const projectTitle =
    projConfig?.title || selectors.selectFileInfo(state, proj.file).title || proj.index;
  const pages: ManifestProject['pages'] = proj.pages.map((page) => {
    if ('file' in page) {
      const title = selectors.selectFileInfo(state, page.file).title || page.slug;
      const { slug, level } = page;
      return { slug, title, level };
    }
    return { ...page };
  });
  const projFrontmatter = fillMissingKeys({}, projConfig, PROJECT_FRONTMATTER_KEYS);
  return {
    ...projFrontmatter,
    title: projectTitle || 'Untitled',
    slug: siteProj.slug,
    index,
    pages,
  };
}

function getLogoPaths(
  session: ISession,
  logoName?: string | null,
): { path: string; public: string; url: string } | null {
  if (!logoName) {
    session.log.debug('No logo specified, Curvespace renderer will use default logo');
    return null;
  }
  if (!fs.existsSync(logoName)) {
    // Look in the local public path
    logoName = join('public', logoName);
  }
  if (!fs.existsSync(logoName))
    throw new Error(`Could not find logo at "${logoName}". See 'config.site.logo'`);
  const logo = `logo${extname(logoName)}`;
  return { path: logoName, public: join(publicPath(session), logo), url: `/${logo}` };
}

function getManifestActionPaths(session: ISession, filePath: string) {
  if (!fs.existsSync(filePath)) {
    // Look in the local public path
    filePath = join('public', filePath);
  }
  if (!fs.existsSync(filePath))
    throw new Error(`Could not find static resource at "${filePath}". See 'config.site.actions'`);
  // Get rid of the first public path if present
  const parts = filePath.split(sep).filter((s, i) => i > 0 || s !== 'public');
  const webUrl = parts.join('/'); // this is not sep! (web url!)
  return { path: filePath, public: join(publicPath(session), ...parts), url: `/${webUrl}` };
}

function getSiteManifestAction(session: ISession, action: SiteAction): SiteAction {
  if (!action.static || !action.url) return { ...action };
  const { url } = getManifestActionPaths(session, action.url);
  return {
    title: action.title,
    url,
    static: true,
  };
}

function getSiteManifestAnalytics(
  session: ISession,
  analytics?: SiteAnalytics,
): SiteAnalytics | undefined {
  if (!analytics) return undefined;
  const { google, plausible, ...rest } = analytics;
  warnOnUnrecognizedKeys(session.log, rest, `${CURVENOTE_YML}#site.analytics:`);
  return {
    google: google || undefined,
    plausible: plausible || undefined,
  };
}

export function copyActionResource(session: ISession, action: SiteAction) {
  if (!action.static || !action.url) return;
  const resource = getManifestActionPaths(session, action.url);
  session.log.debug(
    `Copying static resource from "${resource.path}" to be available at "${resource.url}"`,
  );
  fs.copyFileSync(resource.path, resource.public);
}

export function copyLogo(session: ISession, logoName?: string | null): string | undefined {
  const logo = getLogoPaths(session, logoName);
  if (!logo) return;
  session.log.debug(`Copying logo from ${logo.path} to ${logo.public}`);
  fs.copyFileSync(logo.path, logo.public);
}

/**
 * Build site manifest from local curvenote state
 *
 * Site manifest acts as the configuration to build the curvespace site.
 * It combines local site config and project configs into a single structure.
 */
export function getSiteManifest(session: ISession): SiteManifest {
  const siteProjects: ManifestProject[] = [];
  const state = session.store.getState();
  const siteConfig = selectors.selectLocalSiteConfig(state);
  if (!siteConfig) throw Error('no site config defined');
  siteConfig.projects.forEach((siteProj) => {
    const proj = localToManifestProject(session, state, siteProj);
    if (!proj) return;
    siteProjects.push(proj);
  });
  const { title, twitter, logo, logoText, nav } = siteConfig;
  const actions = siteConfig.actions.map((action) => getSiteManifestAction(session, action));
  const siteFrontmatter = fillMissingKeys(
    {},
    siteConfig as Record<string, any>,
    SITE_FRONTMATTER_KEYS,
  );
  const manifest: SiteManifest = {
    ...siteFrontmatter,
    title: title || '',
    twitter,
    logo: getLogoPaths(session, logo)?.url,
    logoText,
    nav,
    actions,
    projects: siteProjects,
    analytics: getSiteManifestAnalytics(session, siteConfig.analytics),
  };
  return manifest;
}
