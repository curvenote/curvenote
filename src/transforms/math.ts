import katex from 'katex';
import { Math, InlineMath } from 'myst-spec';
import { selectAll } from 'mystjs';
import { ProjectFrontmatter } from '../frontmatter/types';
import { Logger } from '../logging';
import { Root } from '../myst';

function getMathMacros(frontmatter: Pick<ProjectFrontmatter, 'math'>): Record<string, string> {
  const math = frontmatter.math ?? {};
  return Object.fromEntries(
    Object.entries(math).map(([key, value]) => {
      if (typeof value === 'string') return [key, value];
      let { macro } = value;
      // if (value.textcolor) {
      //   macro = `\\textcolor{${value.textcolor}}{${macro}}`;
      // }
      const className = 'cn-math-test';
      macro = `{\\htmlClass{${className}}{${macro}}}`;
      return [key, macro];
    }),
  );
}

export function renderEquation(
  log: Logger,
  node: Math | InlineMath,
  frontmatter: Pick<ProjectFrontmatter, 'math'>,
  file: string,
) {
  const { value } = node;
  if (!value) return;
  const displayMode = node.type === 'math';
  const label = 'label' in node ? `${file}:${node.type}.${node.label}` : `${file}:${node.type}`;
  const macros = getMathMacros(frontmatter);
  try {
    (node as any).html = katex.renderToString(value, {
      displayMode,
      macros: { ...macros },
      strict: (f: string, m: string) =>
        log.warn(`Math Warning: [${label}]: ${f}, ${m}\n\n${node.value}\n`),
    });
  } catch (error) {
    const { message } = error as unknown as Error;
    log.error(`Math Error: [${label}]: ${message}\n\n${node.value}\n`);
    (node as any).error = true;
    (node as any).message = message;
  }
}

export function transformMath(
  log: Logger,
  mdast: Root,
  frontmatter: Pick<ProjectFrontmatter, 'math'>,
  file: string,
) {
  const nodes = selectAll('math,inlineMath', mdast) as (Math | InlineMath)[];
  nodes.forEach((node) => {
    renderEquation(log, node, frontmatter, file);
  });
}
