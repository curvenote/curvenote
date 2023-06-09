import { getDate } from 'simple-validators';
import type { JsonObject } from '../types.js';
import type { KINDS, ChildId, BlockChildDict, BaseVersion } from './types/index.js';
import { ArticleFormatTypes } from './types/index.js';

export interface PartialArticle {
  date: Date;
  order: ChildId[];
  children: BlockChildDict;
}

export interface Article extends BaseVersion, PartialArticle {
  kind: typeof KINDS.Article;
}

export const defaultFormat = ArticleFormatTypes.html;

export function fromDTO(dto: JsonObject): PartialArticle {
  return {
    date: getDate(dto.date),
    order: [...(dto?.order ?? [])],
    children: { ...dto.children },
  };
}
