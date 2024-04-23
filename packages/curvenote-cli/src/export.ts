import { join } from 'node:path';
import fs from 'node:fs';
import {
  localArticleToPdf,
  localArticleToTex,
  localArticleToWord,
  localArticleToJats,
  localProjectToMeca,
  localArticleToTypst,
  createTempFolder,
} from 'myst-cli';
import type { ExportResults } from 'myst-cli';
import type { LinkTransformer } from 'myst-transforms';
import { OxaTransformer } from './transforms/index.js';
import type { ISession } from './session/types.js';
import { oxaLinkToMarkdown } from './sync/pull/markdown.js';

export const localExportWrapper =
  (
    exportLocalArticle: (
      session: ISession,
      path: string,
      opts: { filename: string } & Record<string, any>,
      templateOptions?: Record<string, any>,
      extraLinkTransformers?: LinkTransformer[],
    ) => Promise<ExportResults>,
    defaultOptions: Record<string, any>,
  ) =>
  async (
    session: ISession,
    path: string,
    filename: string,
    opts: Record<string, any>,
    templateOptions?: Record<string, any>,
  ) => {
    let localFolder: string | undefined;
    let localPath: string;
    if (fs.existsSync(path)) {
      session.log.info(`🔍 Found local file to export: ${path}`);
      localPath = path;
    } else {
      session.log.info(`🌍 Downloading: ${path}`);
      const localFilename = 'output.md';
      localFolder = createTempFolder(session);
      localPath = join(localFolder, localFilename);
      await oxaLinkToMarkdown(session, path, localFilename, { path: localFolder });
    }
    const results = await exportLocalArticle(
      session,
      localPath,
      { ...defaultOptions, filename, projectPath: localFolder, ...opts },
      templateOptions,
      [new OxaTransformer(session)],
    );
    if (localFolder) {
      results.tempFolders.push(localFolder);
    }
    return results;
  };

export const oxaLinkToPdf = localExportWrapper(localArticleToPdf, { force: true });
export const oxaLinkToTex = localExportWrapper(localArticleToTex, { force: true });
export const oxaLinkToTypst = localExportWrapper(localArticleToTypst, { force: true });
export const oxaLinkToWord = localExportWrapper(localArticleToWord, {
  force: true,
  template: 'curvenote',
});
export const oxaLinkToJats = localExportWrapper(localArticleToJats, { force: true });
export const oxaLinkToMeca = localExportWrapper(localProjectToMeca, { force: true });
