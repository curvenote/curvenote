import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { Author, Blocks, oxaLink } from '@curvenote/blocks';
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
    curvenote: `${session.SITE_URL}/@user.data.username`,
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

export interface ExportDocumentModel {
  doc: {
    title: string;
    description: string;
    short_title: string;
    authors: ExportAuthorModel[];
    date: ExportDateModel;
    tags: string[];
    oxalink: string | null;
  };
  tagged: Record<string, string>;
  options: Record<string, any>;
}

export async function buildDocumentModel(
  session: Session,
  block: Block,
  version: Version<Blocks.Article>,
  tagged: Record<string, string>,
  options: Record<string, any>,
): Promise<ExportDocumentModel> {
  const authors = await Promise.all(block.data.authors.map((a) => toAuthorFields(session, a)));
  const data = {
    doc: {
      // TODO BUG? we can't get the version title or description because it's not on the DTO
      title: escapeLatex(block.data.title ?? ''),
      description: escapeLatex(block.data.description ?? ''),
      short_title: escapeLatex(toShortTitle(block.data.title ?? '')),
      authors,
      date: toDateFields(version.data.date),
      tags: block.data.tags.map((t) => escapeLatex(t)),
      oxalink: oxaLink(session.SITE_URL, version.id),
    },
    tagged,
    options,
  };

  return data;
}

export function writeDocumentToFile(document: Record<string, any>, basePath?: string) {
  const filename = path.join(basePath ?? '.', 'jtex.yml');
  if (!fs.existsSync(filename)) fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, yaml.dump(document));
}
