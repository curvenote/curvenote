import chokidar from 'chokidar';
import { join, extname } from 'path';
import { CURVENOTE_YML, SiteProject } from '../config/types';
import { ISession } from '../session/types';
import { selectors } from '../store';
import { changeFile, fastProcessFile, processSite } from '../store/local/actions';
import { BUILD_FOLDER } from '../utils';

function watchConfigAndPublic(session: ISession) {
  return chokidar
    .watch([CURVENOTE_YML, 'public'], {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    })
    .on('all', async (eventType: string, filename: string) => {
      session.log.debug(`File modified: "${filename}" (${eventType})`);
      session.log.info('💥 Triggered full site rebuild');
      await processSite(session, { reloadConfigs: true });
    });
}

const KNOWN_FAST_BUILDS = new Set(['.ipynb', '.md']);

function fileProcessor(session: ISession, siteProject: SiteProject) {
  return async (eventType: string, file: string) => {
    if (file.startsWith(BUILD_FOLDER) || file.startsWith('.')) return;
    changeFile(session, file, eventType);
    if (!KNOWN_FAST_BUILDS.has(extname(file))) {
      session.log.info('💥 Triggered full site rebuild');
      await processSite(session, { reloadConfigs: true });
      return;
    }
    const pageSlug = selectors.selectPageSlug(session.store.getState(), siteProject.path, file);
    if (!pageSlug) {
      session.log.warn(`⚠️ File is not in project: ${file}`);
      return;
    }
    await fastProcessFile(session, {
      file,
      projectPath: siteProject.path,
      projectSlug: siteProject.slug,
      pageSlug,
    });
    // TODO: process full site silently and update if there are any
    // await processSite(session, true);
  };
}

export function watchContent(session: ISession) {
  const siteConfig = selectors.selectLocalSiteConfig(session.store.getState());
  if (!siteConfig) return;
  // For each project watch the full content folder
  siteConfig.projects.forEach((proj) => {
    const ignored =
      proj.path === '.'
        ? [
            // If in the root, ignore the YML and all other projects
            CURVENOTE_YML,
            ...siteConfig.projects
              .filter(({ path }) => path !== '.')
              .map(({ path }) => join(path, '*')),
          ]
        : [];
    chokidar
      .watch(proj.path, {
        ignoreInitial: true,
        ignored: ['public', '_build/**', '.git/**', ...ignored],
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
      })
      .on('all', fileProcessor(session, proj));
  });
  // Watch the curvenote.yml
  watchConfigAndPublic(session);
}
