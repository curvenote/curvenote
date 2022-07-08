import type { NodeRenderer } from './types';
import type { GenericParent } from 'mystjs';
import { mystToReact } from './convertToReact';
import BASIC_RENDERERS from './basic';
import ADMONITION_RENDERERS from './admonitions';
import CITE_RENDERERS from './cite';
import FOOTNOTE_RENDERERS from './footnotes';
import CODE_RENDERERS from './code';
import MATH_RENDERERS from './math';
import REACTIVE_RENDERERS from './reactive';
import IFRAME_RENDERERS from './iframe';
import IMAGE_RENDERERS from './image';
import LINK_RENDERERS from './links';
import OUTPUT_RENDERERS from './output';
import HEADING_RENDERERS from './heading';
import CROSS_REFERENCE_RENDERERS from './crossReference';
import RRID_RENDERERS from './rrid';

export type { NodeRenderer } from './types';
export { Bibliography } from './cite';

export const DEFAULT_RENDERERS: Record<string, NodeRenderer> = {
  ...BASIC_RENDERERS,
  ...IMAGE_RENDERERS,
  ...LINK_RENDERERS,
  ...CODE_RENDERERS,
  ...MATH_RENDERERS,
  ...CITE_RENDERERS,
  ...RRID_RENDERERS,
  ...IFRAME_RENDERERS,
  ...FOOTNOTE_RENDERERS,
  ...ADMONITION_RENDERERS,
  ...REACTIVE_RENDERERS,
  ...OUTPUT_RENDERERS,
  ...HEADING_RENDERERS,
  ...CROSS_REFERENCE_RENDERERS,
};

export function useParse(
  node: GenericParent | null,
  renderers: Record<string, NodeRenderer> = DEFAULT_RENDERERS,
) {
  if (!node) return null;
  try {
    const nodes = mystToReact(node, renderers);
    return nodes;
  } catch (error) {
    console.error(error);
    return null;
  }
}
