import fs from 'fs';
import yaml from 'js-yaml';
import { join, relative } from 'path';
import { JupyterBookChapter, TOC } from '../export/jupyter-book/toc';
import { PageLevels, LocalProjectFolder, LocalProjectPage, LocalProject } from './types';
import { removeExtension } from './utils';

function getRelativeDocumentLink(file: string, path: string) {
  if (path === '.') return removeExtension(file);
  return removeExtension(relative(path, file));
}

const GENERATED_TOC_HEADER = `# Table of Contents
#
# Curvenote will respect:
# 1. New pages
#      - file: relative/path/to/page
# 2. New sections without an associated page
#      - title: Folder Title
#        sections: ...
# 3. New sections with an associated page
#      - file: relative/path/to/page
#        sections: ...
#
# Note: Titles defined on pages here are not recognized.
#
# This spec is based on the Jupyterbook table of contents.
# Learn more at https://jupyterbook.org/customize/toc.html

`;

function chaptersFromPages(pages: (LocalProjectFolder | LocalProjectPage)[], path: string) {
  const levels = pages.map((page) => page.level);
  const currentLevel = Math.min(...levels) as PageLevels;
  const currentLevelIndices = levels.reduce((inds: number[], val: PageLevels, i: number) => {
    if (val === currentLevel) {
      inds.push(i);
    }
    return inds;
  }, []);
  const chapters: JupyterBookChapter[] = currentLevelIndices.map((index, i) => {
    let nextPages: (LocalProjectFolder | LocalProjectPage)[];
    if (currentLevelIndices[i + 1]) {
      nextPages = pages.slice(index + 1, currentLevelIndices[i + 1]);
    } else {
      nextPages = pages.slice(index + 1);
    }
    const chapter: JupyterBookChapter = {};
    if ('file' in pages[index]) {
      const page = pages[index] as LocalProjectPage;
      chapter.file = getRelativeDocumentLink(page.file, path);
    } else if ('title' in pages[index]) {
      const page = pages[index] as LocalProjectFolder;
      chapter.title = page.title;
    }
    if (nextPages.length) {
      chapter.sections = chaptersFromPages(nextPages, path);
    }
    return chapter;
  });
  return chapters;
}

/**
 * Create a jupyterbook toc structure from project pages
 *
 * Output consists of a top-level chapter with files/sections
 * based on project structure. Sections headings may be either
 * associated with a `file` (results in clickable in page)
 * or just a `title` (results in unclickable in heading)
 */
export function tocFromProject(project: LocalProject, path = '.') {
  const toc: TOC = {
    format: 'jb-book',
    root: getRelativeDocumentLink(project.file, path),
    chapters: chaptersFromPages(project.pages, path),
  };
  return toc;
}

export function writeTocFromProject(project: LocalProject, path: string) {
  const filename = join(path, '_toc.yml');
  const content = `${GENERATED_TOC_HEADER}${yaml.dump(tocFromProject(project, path))}`;
  fs.writeFileSync(filename, content);
}
