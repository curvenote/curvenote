import { CitationRenderer } from 'citation-js-utils';
import { GenericNode, map } from 'mystjs';
import { PageFrontmatter } from '../frontmatter/types';
import { Root } from '../myst';

export type MapResult = ReturnType<typeof map>;

export type Citations = {
  order: string[];
  data: Record<string, { html: string; number: number; doi: string | undefined }>;
};

export type Footnotes = Record<string, GenericNode>;

export type References = {
  cite: Citations;
  footnotes: Footnotes;
};

export interface RendererData {
  sha256: string;
  frontmatter: PageFrontmatter;
  mdast: Root;
  references: References;
}

export type SingleCitationRenderer = { id: string; render: CitationRenderer[''] };
