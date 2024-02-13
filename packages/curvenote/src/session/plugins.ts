import fs from 'node:fs';
import { plural } from 'myst-common';
import { loadPlugins, selectors } from 'myst-cli';
import type { CurvenotePlugin, ISession } from './types.js';

/**
 * Load user-defined plugin modules declared in the project frontmatter
 *
 * @param session session with logging
 */
export async function loadCurvenotePlugins(session: ISession): Promise<CurvenotePlugin> {
  const config = selectors.selectCurrentProjectConfig(session.store.getState());
  const mystPlugins = await loadPlugins(session);
  const plugins: CurvenotePlugin = {
    ...mystPlugins,
    checks: [],
  };
  if (!config?.plugins || config.plugins.length === 0) {
    return plugins;
  }
  // Already validated by myst plugin loader
  const modules = await Promise.all(
    config?.plugins?.map(async (filename) => {
      if (fs.statSync(filename).isFile() && filename.endsWith('.mjs')) {
        let module: any;
        try {
          module = await import(filename);
        } catch (error) {
          return null;
        }
        return { filename, module };
      }
      return null;
    }),
  );
  modules.forEach((pluginLoader) => {
    if (!pluginLoader) return;
    const plugin: CurvenotePlugin = pluginLoader.module.default || pluginLoader.module.plugin;
    const checks = plugin.checks || pluginLoader.module.checks;
    if (checks) {
      session.log.debug(
        `🔌 ${plugin?.name ?? 'Unnamed Plugin'} (${
          pluginLoader.filename
        }) also loaded loaded: ${plural('%s check(s)', checks)}`,
      );
      // TODO: validate each check
      plugins.checks.push(...checks);
    }
  });
  session.log.debug('Curvenote Plugins loaded');
  return plugins;
}
