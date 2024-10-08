import path from 'node:path';
import { loadProjectFromDisk, selectFile } from 'myst-cli';
import type { GenericNode } from 'myst-common';
import { copyNode, extractPart } from 'myst-common';
import { getCheckDefinition } from '@curvenote/check-definitions';
import type { CheckInterface } from '../types.js';
import { error, fail, pass } from '../utils.js';
import { PAGE_KNOWN_PARTS } from 'myst-frontmatter';
import { count } from '@wordpress/wordcount';

function upper(val: string) {
  return val.slice(0, 1).toUpperCase() + val.slice(1);
}

function toWordCountText(
  content: GenericNode | GenericNode[],
  opts: { figures?: boolean; footnotes?: boolean },
): string {
  const defaultHandler = (n: GenericNode) => {
    // If both children and value are defined, only children is counted
    if ('children' in n && n.children) return toWordCountText(n.children, opts);
    if ('value' in n) return n.value;
    return '';
  };
  const defaultWithNewLine = (n: GenericNode) => {
    return `${defaultHandler(n)}\n\n`;
  };
  const nodeReplacement: Record<string, string | ((n: GenericNode) => string)> = {
    math: 'MATH\n\n',
    inlineMath: 'MATH',
    captionNumber: '',
    mermaid: '',
    comment: '',
    paragraph: defaultWithNewLine,
    heading: defaultWithNewLine,
    listItem: defaultWithNewLine,
    tableCell: defaultWithNewLine,
    code: defaultWithNewLine,
    break: '\n\n',
    cite: '',
  };
  if (!opts.figures) {
    nodeReplacement['container'] = '';
  }
  if (!opts.footnotes) {
    nodeReplacement['footnoteDefinition'] = '';
  }
  if (!Array.isArray(content)) return toWordCountText([content], opts);
  return content
    .map((n) => {
      if (nodeReplacement[n.type] != null) {
        const handler = nodeReplacement[n.type];
        return typeof handler === 'string' ? handler : handler(n);
      }
      return defaultHandler(n);
    })
    .join('');
}

export const wordCount: CheckInterface = {
  ...getCheckDefinition('word-count'),
  validate: async (session, opts) => {
    const { part, figures, footnotes, min, max } = opts;
    const { file } = await loadProjectFromDisk(session);
    const { mdast } = selectFile(session, path.resolve(file)) ?? {};
    if (!mdast) return error('Error loading content', { file });
    let content = copyNode(mdast);
    if (part) {
      // Only count part
      const partContent = extractPart(content, part);
      if (!partContent) {
        return error(`No ${part} found`, { file });
      }
      content = partContent;
    } else {
      // Do not count known parts; remove them from content
      PAGE_KNOWN_PARTS.forEach((knownPart) => {
        extractPart(content, knownPart);
      });
    }
    const length = count(toWordCountText(content, { figures, footnotes }), 'words', {});
    if (length > max) {
      return fail(`${upper(part ?? 'document')} is too long: ${length}/${max} words`, {
        file,
        position: content.position,
        help: `Shorten your ${part ?? 'document'} to less than ${max} words`,
      });
    }
    if (length < min) {
      return fail(`${upper(part ?? 'document')} is too short: ${length}/${min} words`, {
        file,
        position: content.position,
        help: `Increase the length of your ${part ?? 'document'} to more than ${min} words`,
      });
    }
    return pass(
      `${upper(part ?? 'document')} is correct length (${length}${max == null ? '' : `/${max}`} words)`,
      {
        file,
        position: content.position,
        nice: `${upper(part ?? 'document')} is a good length 🔢`,
      },
    );
  },
};

export const wordCountRules = [wordCount];
