import type { CurvenotePlugin, ValidatedCurvenotePlugin } from './types.js';
import cliPlugins from '@curvenote/cli-plugin';
import extPerson from '@curvenote/ext-person';
import extTemplate from '@curvenote/ext-template';
import extBlog from '@curvenote/ext-blog';
import extFooter from '@curvenote/ext-footer';
import extScienceicons from '@scienceicons/myst';

function toValidated(plugin: CurvenotePlugin): ValidatedCurvenotePlugin {
  return {
    directives: plugin.directives ?? [],
    roles: plugin.roles ?? [],
    transforms: plugin.transforms ?? [],
    checks: plugin.checks ?? [],
    renderers: plugin.renderers ?? [],
    paths: plugin.paths ?? [],
    checksPaths: plugin.checksPaths ?? [],
  };
}

export function combinePlugins(plugins: CurvenotePlugin[]): ValidatedCurvenotePlugin {
  if (plugins.length === 0) {
    return toValidated({});
  }
  return plugins.slice(1).reduce<ValidatedCurvenotePlugin>(
    (base, next) => ({
      directives: [...base.directives, ...(next.directives ?? [])],
      roles: [...base.roles, ...(next.roles ?? [])],
      transforms: [...base.transforms, ...(next.transforms ?? [])],
      checks: [...base.checks, ...(next.checks ?? [])],
      renderers: [...base.renderers, ...(next.renderers ?? [])],
      paths: [...base.paths, ...(next.paths ?? [])],
      checksPaths: [...base.checksPaths, ...(next.checksPaths ?? [])],
    }),
    toValidated(plugins[0]),
  );
}

export function getBuiltInPlugins() {
  return combinePlugins([cliPlugins, extPerson, extTemplate, extBlog, extScienceicons, extFooter]);
}
