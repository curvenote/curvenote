import type { WorkCreateOption } from '../extensions/types.js';

export const BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID = 'article';

/** Built-in Article upload flow (current `/app/works/new` behaviour). */
export const BUILTIN_ARTICLE_WORK_CREATE_OPTION: WorkCreateOption = {
  id: BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID,
  label: 'Article',
  description: 'Upload a manuscript for checks and publishing',
  metadataKey: 'frontmatter.myst',
  startPath: '/app/works/new',
  mode: 'composite',
  order: 0,
};
