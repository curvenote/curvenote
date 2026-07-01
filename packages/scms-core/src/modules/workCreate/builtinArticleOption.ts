import { FileText } from 'lucide-react';
import type { WorkCreateOption } from '../extensions/types.js';

export const BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID = 'article';

/** Built-in Article upload flow (current `/app/works/new` behaviour). */
export const BUILTIN_ARTICLE_WORK_CREATE_OPTION: WorkCreateOption = {
  id: BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID,
  label: 'Article',
  description: 'upload files for a long form article',
  icon: FileText,
  metadataKey: 'frontmatter.myst',
  startPath: '/app/works/new',
  mode: 'composite',
  order: 0,
};
