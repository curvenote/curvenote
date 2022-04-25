import { GenericNode, select } from 'mystjs';
import { Root } from './types';

export function ensureBlockNesting(mdast: Root) {
  if (!select('block', mdast)) {
    const blockNode = { type: 'block', children: mdast.children as GenericNode[] };
    (mdast as GenericNode).children = [blockNode];
  }
}
