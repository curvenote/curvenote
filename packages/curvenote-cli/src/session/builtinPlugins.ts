import type { CurvenotePlugin, ValidatedCurvenotePlugin } from './types.js';
import cliPlugins from '@curvenote/cli-plugin';
import extPerson from '@curvenote/ext-person';
import extTemplate from '@curvenote/ext-template';
import extBlog from '@curvenote/ext-blog';
import extLanding from '@curvenote/ext-landing';
import extFooter from '@curvenote/ext-footer';
import extScienceicons from '@scienceicons/myst';

export function combinePlugins(plugins: CurvenotePlugin[]): ValidatedCurvenotePlugin {
  return plugins.slice(1).reduce(
    (base, next) => ({
      directives: [...(base.directives ?? []), ...(next.directives ?? [])],
      roles: [...(base.roles ?? []), ...(next.roles ?? [])],
      transforms: [...(base.transforms ?? []), ...(next.transforms ?? [])],
      checks: [...(base.checks ?? []), ...(next.checks ?? [])],
      paths: [
        ...((base as ValidatedCurvenotePlugin).paths ?? []),
        ...((next as ValidatedCurvenotePlugin).paths ?? []),
      ],
    }),
    plugins[0],
  ) as ValidatedCurvenotePlugin;
}

export function getBuiltInPlugins() {
  return combinePlugins([
    cliPlugins,
    extPerson,
    extTemplate,
    extBlog,
    extLanding,
    extScienceicons,
    extFooter,
  ]);
}
