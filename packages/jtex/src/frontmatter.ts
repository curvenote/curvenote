import type { PageFrontmatter } from '@curvenote/frontmatter';
import type { ValidationOptions } from '@curvenote/validators';
import { incrementOptions, validateList, validateObjectKeys } from '@curvenote/validators';
import { errorLogger } from './validators';
import type { ISession, RendererDoc } from './types';

export function extendJtexFrontmatter(
  session: ISession,
  frontmatter: PageFrontmatter,
): RendererDoc {
  const datetime = frontmatter.date ? new Date(frontmatter.date) : new Date();
  const opts: ValidationOptions = {
    property: 'frontmatter',
    messages: {},
    errorLogFn: errorLogger(session),
  };
  // Additional validation beyond standard frontmatter validation
  const filteredFm = validateObjectKeys(
    frontmatter,
    { required: ['title', 'description', 'authors'] },
    opts,
  );
  if (opts.messages.errors?.length || !filteredFm) {
    throw new Error('Required frontmatter missing for export');
  }
  const validatedAuthors = validateList(filteredFm.authors, opts, (author, ind) => {
    return validateObjectKeys(
      author,
      { required: ['name'] },
      incrementOptions(`author.${ind}`, opts),
    );
  });
  if (opts.messages.errors?.length || !validatedAuthors) {
    throw new Error('Required author fields missing for export');
  }
  const doc: RendererDoc = {
    title: filteredFm.title || '',
    description: filteredFm.description || '',
    date: {
      day: String(datetime.getDate()),
      month: String(datetime.getMonth() + 1),
      year: String(datetime.getFullYear()),
    },
    authors: validatedAuthors.map((author) => {
      return {
        name: author.name,
        affiliations: author.affiliations || [],
        orcid: author.orcid,
      };
    }),
  };
  return doc;
}