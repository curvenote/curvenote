import path from 'node:path';
import type { BuildOpts } from 'myst-cli';
import {
  build,
  startServer,
  buildSite,
  watchContent,
  buildHtml,
  exportSite,
  collectAllBuildExportOptions,
  localArticleExport,
  selectors,
  writeJsonLogs,
  readableName,
} from 'myst-cli';
import { addTransformersToOpts } from '../utils/utils.js';
import type { ISession } from '../session/types.js';

export const curvenoteBuild = async (session: ISession, files: string[], opts: BuildOpts) => {
  const optsWithTransformers = addTransformersToOpts(session, opts);
  const performSiteBuild =
    opts.all ||
    (files.length === 0 && exportSite(session, opts)) ||
    !!opts.writeDOIBib;

  if (opts.watch && performSiteBuild) {
    const exportOptionsList = await collectAllBuildExportOptions(
      session,
      files,
      optsWithTransformers,
    );
    const buildLog: Record<string, unknown> = {
      input: { files, opts, performSiteBuild },
      exports: exportOptionsList,
    };
    if (exportOptionsList.length > 0) {
      const exportLogList = exportOptionsList.map(
        (exp) => `${path.relative('.', exp.$file)} -> ${exp.output}`,
      );
      session.log.info(`📬 Performing exports:\n   ${exportLogList.join('\n   ')}`);
      await localArticleExport(session, exportOptionsList, optsWithTransformers);
    }
    const siteConfig = selectors.selectCurrentSiteConfig(session.store.getState());
    if (siteConfig) {
      session.log.info(`🌎 Building ${readableName()} site`);
      if (opts.html) {
        buildLog.buildHtml = true;
        await buildHtml(session, optsWithTransformers);
      } else {
        buildLog.buildSite = true;
        await buildSite(session, optsWithTransformers);
        watchContent(session, () => {}, optsWithTransformers);
        session.log.info('\nWatching for changes. Press Ctrl+C to stop.\n');
      }
    }
    writeJsonLogs(session, 'myst.build.json', buildLog);
    return;
  }

  await build(session, files, optsWithTransformers);
};

export const curvenoteStart = async (session: ISession, opts: BuildOpts) => {
  await startServer(session, addTransformersToOpts(session, opts));
};

export * from './deploy.js';
