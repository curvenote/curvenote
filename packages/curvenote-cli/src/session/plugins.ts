import fs from 'node:fs';
import { plural } from 'myst-common';
import { loadPlugins } from 'myst-cli';
import type { CurvenotePlugin, ISession, ValidatedCurvenotePlugin } from './types.js';
import type { PluginInfo } from 'myst-config';

/**
 * Load user-defined plugin modules declared in the project frontmatter
 *
 * @param session session with logging
 */
export async function loadProjectPlugins(
  session: ISession,
  plugins: PluginInfo[],
): Promise<ValidatedCurvenotePlugin> {
  const loadedPlugins: ValidatedCurvenotePlugin = {
    checks: [],
    checksPaths: [],
    ...(await loadPlugins(session, plugins)),
  };

  // Deduplicate by checksPath (must be separate than path, which is already written at this point)...
  const newChecksPlugins = [...new Map(plugins.map((info) => [info.path, info])).values()].filter(
    // ...and filter out already loaded plugins
    ({ path }) => !loadedPlugins.checksPaths.includes(path),
  );
  if (newChecksPlugins.length === 0) {
    return loadedPlugins;
  }
  // Already validated by myst plugin loader
  const modules = await Promise.all(
    newChecksPlugins.map(async (plugin) => {
      if (fs.statSync(plugin.path).isFile() && plugin.path.endsWith('.mjs')) {
        let module: any;
        try {
          module = await import(plugin.path);
        } catch (error) {
          return null;
        }
        return { path: plugin.path, module };
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
          pluginLoader.path
        }) also loaded loaded: ${plural('%s check(s)', checks)}`,
      );
      // TODO: validate each check
      loadedPlugins.checks.push(...checks);
    }
  });
  session.log.debug('Project Plugins loaded');
  return loadedPlugins;
}
