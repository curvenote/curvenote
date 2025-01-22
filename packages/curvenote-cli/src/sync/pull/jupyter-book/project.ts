import type { ProjectId, Blocks } from '@curvenote/blocks';
import { KINDS, NavListItemKindEnum } from '@curvenote/blocks';
import type { Version } from '../../../models.js';
import { Project } from '../../../models.js';
import type { ISession } from '../../../session/types.js';
import type { MarkdownExportOptions } from '../markdown.js';
import { articleToMarkdown } from '../markdown.js';
import type { NotebookExportOptions } from '../notebook.js';
import { notebookToIpynb } from '../notebook.js';
import { getBlockAndLatestVersion } from '../utils/getBlockAndLatestVersion.js';
import type { ArticleState } from '../utils/walkArticle.js';
import { writeBibtex } from '../utils/writeBibtex.js';
import { writeConfig } from './config.js';
import { writeTOC } from './toc.js';

type Options = Omit<MarkdownExportOptions, 'filename' | 'writeBibtex'> &
  Omit<NotebookExportOptions, 'filename'> & {
    writeConfig?: boolean;
    ci?: boolean;
  };

async function pullAll(session: ISession, nav: Version<Blocks.Navigation>, opts?: Options) {
  const { bibtex = 'references.bib' } = opts ?? {};
  const blocks = await Promise.all(
    nav.data.items.map((item) => {
      if (item.kind === NavListItemKindEnum.Item)
        return getBlockAndLatestVersion(session, item.blockId).catch(() => null);
      return null;
    }),
  );
  const articles = await Promise.all(
    blocks.map(async (blockData) => {
      if (!blockData) return null;
      const { block, version } = blockData;
      if (!version) {
        session.log.error(
          `Unable to download "${block.data.name}" - do you need to save the draft?`,
        );
        return null;
      }
      switch (block.data.kind) {
        case KINDS.Article: {
          const filename = `${block.data.name ?? block.id.block}.md`;
          try {
            const article = await articleToMarkdown(session, version.id, {
              ...opts,
              filename,
              writeBibtex: false,
            });
            return article;
          } catch (error) {
            session.log.debug(`\n\n${(error as Error)?.stack}\n\n`);
            session.log.error(`Problem downloading article: ${block.data.name}`);
            return null;
          }
        }
        case KINDS.Notebook: {
          const filename = `${block.data.name ?? block.id.block}.ipynb`;
          try {
            const article = await notebookToIpynb(session, version.id, { ...opts, filename });
            return article;
          } catch (error) {
            session.log.debug(`\n\n${(error as Error)?.stack}\n\n`);
            session.log.error(`Problem downloading notebook: ${block.data.name}`);
            return null;
          }
        }
        default:
          session.log.warn(`Skipping block: "${block.data.name}" of kind "${block.data.kind}"`);
          return null;
      }
    }),
  );
  const references: ArticleState['references'] = articles.reduce(
    (obj, a) => ({ ...obj, ...a?.references }),
    {} as ArticleState['references'],
  );
  await writeBibtex(session, references, bibtex, { path: opts?.path, alwaysWriteFile: false });
}

/**
 * Write jupyterbook from project
 *
 * Logs an error if no version of the nav is saved.
 */
export async function projectToJupyterBook(session: ISession, projectId: ProjectId, opts: Options) {
  const [project, { version: nav }] = await Promise.all([
    new Project(session, projectId).get(),
    getBlockAndLatestVersion<Blocks.Navigation>(session, { project: projectId, block: 'nav' }),
  ]);
  if (!nav) {
    session.log.error(
      `Unable to load project navigation "${project.data.name}" - please save any article in your project?`,
    );
    return;
  }
  if (opts.writeConfig ?? true) {
    writeConfig(session, {
      path: opts.path,
      title: project.data.title,
      author: project.data.team,
      url: `${session.config.editorUrl}/@${project.data.team}/${project.data.name}`,
    });
  }
  await writeTOC(session, nav, { path: opts.path, ci: opts.ci });
  await pullAll(session, nav, { bibtex: 'references.bib', ...opts });
}
