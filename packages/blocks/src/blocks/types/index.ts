import type { BaseLinks } from '../../types.js';
import type { FormatTypes } from './format.js';
import type { BlockFrontMatterProps } from './frontMatter.js';
import type { BlockId, ChildId, VersionId } from './id.js';
import type { KINDS } from './kind.js';

export * from './id.js';
export * from './kind.js';
export * from './format.js';
export * from './author.js';
export * from './misc.js';
export * from './jupyter.js';
export * from './messages.js';
export * from './frontMatter.js';

export interface BlockLinks extends BaseLinks {
  project: string;
  comments: string;
  versions: string;
  created_by: string;
  drafts: string;
  thumbnail?: string;
  default_draft?: string;
  latest?: string;
  published?: string;
}
export interface VersionLinks extends BaseLinks {
  download: string;
  project: string;
  block: string;
  versions: string;
  created_by: string;
  drafts: string;
  parent?: string;
  output?: string;
  artifacts?: {
    tex?: string;
    pdf?: string;
  };
}

export interface PartialBlock extends BlockFrontMatterProps {
  id: BlockId;
  kind: KINDS;
  title: string;
  description: string;
  caption: string | null;
  name: string | null;
  tags: string[];
  part: string | null;
  default_draft: string | null;
  pending: string | null;
}

export interface Block extends PartialBlock {
  hidden: boolean;
  published: boolean;
  published_versions: number[];
  latest_version: number | null;
  num_versions: number;
  num_comments: number;
  created_by: string;
  date_created: Date;
  date_modified: Date;
  links: BlockLinks;
}

export interface BasePartialVersion {
  format: FormatTypes;
}

export interface BaseVersion extends BasePartialVersion {
  id: VersionId;
  kind: KINDS;
  title: string;
  description: string;
  caption: string | null;
  created_by: string;
  date_created: Date;
  version: number;
  published: boolean;
  parent: string | null;
  links: VersionLinks;
}

export type SrcId = {
  project: string;
  block: string;
  version: number | null;
  draft: string | null;
};

export type Alignment = 'left' | 'center' | 'right';

export interface FigureStyles {
  width?: number;
  align?: Alignment;
  numbered?: boolean;
  caption?: boolean;
}

export interface FigureFormatOptions {
  figures?: FigureStyles & { label?: string };
}

export type FormatOptions = FigureFormatOptions;

export type BlockChild = {
  id: ChildId;
  src: SrcId;
  style: FigureStyles | null;
};

export type NotebookCodeBlockChild = BlockChild & {
  output?: SrcId;
};

export interface BlockChildDict {
  [index: string]: BlockChild | NotebookCodeBlockChild;
}

export type ChildrenAndOrder = {
  children: BlockChildDict;
  order: ChildId[];
};

export enum NavListItemKindEnum {
  Group = 'group',
  Item = 'item',
}

export interface NavListGroupItemDTO {
  id: string;
  kind: NavListItemKindEnum.Group;
  title: string;
}

export interface NavListBlockItemDTO {
  id: string;
  kind: NavListItemKindEnum.Item;
  title: string;
  parentId: string | null;
  blockId: BlockId;
}

export type NavListItemDTO = NavListBlockItemDTO | NavListGroupItemDTO;

export type Language = string;
