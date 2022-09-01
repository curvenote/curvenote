// import type { PhrasingContent } from 'mdast';

type ValueAndChildren = {
  value?: string;
  children?: ValueAndChildren[];
};

export function toText(content: ValueAndChildren[]): string {
  return content
    .map((n) => {
      if ('value' in n) return n.value;
      if ('children' in n && n.children) return toText(n.children);
      return '';
    })
    .join('');
}
