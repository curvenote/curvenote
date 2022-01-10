import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { Author, Blocks, ManifestId, oxaLink } from '@curvenote/blocks';
import { Session } from 'session';
import { toTex } from '@curvenote/schema';
import { Block, User, Version } from '../../models';
import { getEditorState } from '../../actions/utils';

function escapeLatex(maybeUnsafe: string): string {
  return toTex(getEditorState(`<p>${maybeUnsafe}</p>`).doc);
}

function toShortTitle(title: string): string {
  return title.slice(0, 50);
}

function toDateFields(d: Date): ExportDateModel {
  return {
    year: d.getFullYear(),
    month: d.getMonth(), // will be zero indexed, check this is what jtex expects
    day: d.getDate(),
  };
}

async function toAuthorFields(session: Session, author: Author): Promise<ExportAuthorModel> {
  if (author.plain) return { name: author.plain, is_corresponding: false };

  const user = await new User(session, author.user as string).get();
  return {
    name: user.data.display_name,
    affiliation: user.data.affiliation,
    location: user.data.location,
    curvenote: `${session.SITE_URL}/@${user.data.username}`,
    is_corresponding: false,
  };
}

export interface ExportDateModel {
  year: number;
  month: number;
  day: number;
}

export interface ExportAuthorModel {
  name: string;
  affiliation?: string;
  location?: string;
  curvenote?: string;
  is_corresponding: boolean;
}

export interface JtexOutputConfig {
  path: string;
  filename: string;
  copy_images: boolean;
  single_file: boolean;
}

export interface LatexFrontMatter {
  title: string;
  description: string;
  short_title: string;
  authors: ExportAuthorModel[];
  date: ExportDateModel;
  tags: string[];
  oxalink: string | null;
  jtex: {
    version: number;
    template: string | null;
    input: {
      references: string;
      tagged: Record<string, string>;
    };
    output: JtexOutputConfig;
    options: Record<string, any>;
  };
}

export async function buildFrontMatter(
  session: Session,
  block: Block,
  version: Version<Blocks.Article>,
  template: string | null,
  tagged: Record<string, string>,
  options: Record<string, any>,
  output: JtexOutputConfig,
): Promise<LatexFrontMatter> {
  const authors = await Promise.all(block.data.authors.map((a) => toAuthorFields(session, a)));
  const data = {
    title: escapeLatex(block.data.title ?? ''),
    description: escapeLatex(block.data.description ?? ''),
    short_title: escapeLatex(toShortTitle(block.data.title ?? '')),
    authors,
    date: toDateFields(version.data.date),
    tags: block.data.tags.map((t) => escapeLatex(t)),
    oxalink: oxaLink(session.SITE_URL, version.id),
    jtex: {
      version: 1,
      template,
      input: {
        references: 'main.bib',
        tagged,
      },
      output,
      options,
    },
  };
  return data;
}

const FM_DELIM = '% ---';
const FM_LINE = '% ';

export function stringifyFrontMatter(data: LatexFrontMatter) {
  const lines = YAML.stringify(data)
    .split('\n')
    .filter((line) => line.length > 0);
  const fm = lines.map((line) => `${FM_LINE}${line}`);
  return `${FM_DELIM}\n${fm.join('\n')}\n${FM_DELIM}\n`;
}
