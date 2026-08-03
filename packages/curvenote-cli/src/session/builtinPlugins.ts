import type { CurvenotePlugin, ValidatedCurvenotePlugin } from './types.js';
import cliPlugins from '@curvenote/cli-plugin';
import extPerson from '@curvenote/ext-person';
import extTemplate from '@curvenote/ext-template';
import extBlog from '@curvenote/ext-blog';
import extFooter from '@curvenote/ext-footer';
import extScienceicons from '@scienceicons/myst';

export function combinePlugins(plugins: CurvenotePlugin[]): ValidatedCurvenotePlugin {
  return plugins.slice(1).reduce(
    (base, next) => ({
      directives: [...(base.directives ?? []), ...(next.directives ?? [])],
      roles: [...(base.roles ?? []), ...(next.roles ?? [])],
      transforms: [...(base.transforms ?? []), ...(next.transforms ?? [])],
      checks: [...(base.checks ?? []), ...(next.checks ?? [])],
      renderers: [...(base.renderers ?? []), ...(next.renderers ?? [])],
      paths: [
        ...((base as ValidatedCurvenotePlugin).paths ?? []),
        ...((next as ValidatedCurvenotePlugin).paths ?? []),
      ],
      checksPaths: [
        ...((base as ValidatedCurvenotePlugin).checksPaths ?? []),
        ...((next as ValidatedCurvenotePlugin).checksPaths ?? []),
      ],
    }),
    {
      ...plugins[0],
      renderers: plugins[0].renderers ?? [],
      checks: plugins[0].checks ?? [],
      checksPaths: (plugins[0] as ValidatedCurvenotePlugin).checksPaths ?? [],
      paths: (plugins[0] as ValidatedCurvenotePlugin).paths ?? [],
    },
  ) as ValidatedCurvenotePlugin;
}

export function getBuiltInPlugins() {
  return combinePlugins([cliPlugins, extPerson, extTemplate, extBlog, extScienceicons, extFooter]);
}
