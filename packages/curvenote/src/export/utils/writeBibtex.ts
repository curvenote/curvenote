import { writeFileToFolder } from 'myst-cli-utils';
import type { ISession } from '../../session/types.js';
import { resolvePath } from '../../utils/index.js';
import type { ArticleState } from './walkArticle.js';

type Options = {
  path?: string;
  alwaysWriteFile: boolean;
};

export async function writeBibtex(
  session: ISession,
  references: ArticleState['references'],
  filename = 'main.bib',
  opts: Options = { alwaysWriteFile: true },
) {
  const seen: string[] = [];
  const bibliography = Object.entries(references)
    .map(([, { label, bibtex }]) => {
      if (seen.indexOf(label) !== -1) {
        session.log.debug(`Dropping duplicate reference ${label}`);
        return null;
      }
      seen.push(label);
      return bibtex;
    })
    .filter((item: string | null | undefined) => item != null);

  if (bibliography.length === 0 && !opts.alwaysWriteFile) {
    session.log.debug('No references to write for the project.');
    return;
  }
  const pathname = resolvePath(opts.path, filename);
  session.log.debug(`Exporting references to ${pathname}`);
  const bibWithNewLine = `${bibliography.join('\n\n')}\n`.replace(/&/g, '\\&');
  session.log.debug(`Concatenated bibtex content at ${bibWithNewLine.length} characters`);
  writeFileToFolder(pathname, bibWithNewLine, { encoding: 'utf8' });
  session.log.debug(`Wrote to ${pathname} successfully`);
}
