import fs from 'node:fs';
import type { ExportResults } from 'myst-cli';
import { createTempFolder } from 'myst-cli';
import type { LinkTransformer } from 'myst-transforms';
import { join } from 'node:path';
import { OxaTransformer } from '../../transforms/index.js';
import type { ISession } from '../../session/types.js';
import { oxaLinkToMarkdown } from '../markdown/index.js';

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
