import type { VersionId } from '@curvenote/blocks';
import { oxaLinkToId } from '@curvenote/blocks';
import { Block } from '../../../models.js';
import type { ISession } from '../../../session/types.js';
import { getBlockAndLatestVersion } from './getBlockAndLatestVersion.js';
import type { ArticleState } from './walkArticle.js';

export const remoteExportWrapper =
  (
    exportRemoteArticle: (
      session: ISession,
      id: VersionId,
      opts: { filename: string },
    ) => Promise<ArticleState | void>,
  ) =>
  async (session: ISession, path: string, filename: string, opts?: Record<string, string>) => {
    const id = oxaLinkToId(path);
    if (!id) {
      throw new Error(`Unknown article: ${path}`);
    } else if ('version' in id.block) {
      // Ensure that we actually get a correct ID, and then use the version supplied
      const block = await new Block(session, id.block).get();
      await exportRemoteArticle(
        session,
        { ...block.id, version: id.block.version },
        { filename, ...opts },
      );
    } else {
      // Here we will load up the latest version
      const { version } = await getBlockAndLatestVersion(session, id.block);
      if (!version) {
        session.log.error('Could not download article; do you need to save the draft?');
      } else {
        await exportRemoteArticle(session, version.id, { filename, ...opts });
      }
    }
  };
