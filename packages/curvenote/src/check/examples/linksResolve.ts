import pLimit from 'p-limit';
import { checkLink, selectFile } from 'myst-cli';
import type { GenericNode } from 'myst-common';
import { selectAll } from 'unist-util-select';
import type { ISession } from '../../session/types.js';
import { CheckStatus } from '../types.js';
import type { CheckInterface } from '../types.js';

const limitOutgoingConnections = pLimit(25);

export const linksResolve: CheckInterface = {
  id: 'links-resolve',
  title: 'Links Resolve',
  description: 'Ensure all external URLs resolve',
  category: 'content',
  validate: async (session: ISession, file: string) => {
    const { mdast } = selectFile(session, file) ?? {};
    if (!mdast) {
      return { status: CheckStatus.error, message: `Error loading content from ${file}` };
    }
    const linkNodes = (selectAll('link,linkBlock,card', mdast) as GenericNode[]).filter(
      (link) => !(link.internal || link.static),
    );
    if (linkNodes.length === 0) return [];
    const linkResults = await Promise.all(
      linkNodes.map(async (node) =>
        limitOutgoingConnections(async () => {
          const check = await checkLink(session, node.url);
          if (check.ok || check.skipped) {
            return { status: CheckStatus.pass, message: node.url, file, position: node.position };
          }
          const status = check.status ? ` (${check.status}, ${check.statusText})` : '';
          return {
            status: CheckStatus.fail,
            message: `${node.url}${status}`,
            file,
            position: node.position,
          };
        }),
      ),
    );
    return linkResults;
  },
};
