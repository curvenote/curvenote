import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { plural } from 'myst-common';
import { loadPlugins } from 'myst-cli';
import type {
  CurvenotePlugin,
  CurvenoteRendererSpec,
  ISession,
  ValidatedCurvenotePlugin,
} from './types.js';
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
  const mystPlugins = await loadPlugins(session, plugins);
  const loadedPlugins: ValidatedCurvenotePlugin = {
    ...mystPlugins,
    checks: (mystPlugins as ValidatedCurvenotePlugin).checks ?? [],
    checksPaths: (mystPlugins as ValidatedCurvenotePlugin).checksPaths ?? [],
    renderers: (mystPlugins as ValidatedCurvenotePlugin).renderers ?? [],
  };

  // Deduplicate by checksPath (must be separate than path, which is already written at this point)...
  const newChecksPlugins = [...new Map(plugins.map((info) => [info.path, info])).values()].filter(
    // ...and filter out already loaded plugins
    ({ path: pluginPath }) => !loadedPlugins.checksPaths.includes(pluginPath),
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
          module = await import(pathToFileURL(plugin.path).href);
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
      loadedPlugins.checks.push(...checks);
    }
    const renderers = plugin.renderers || pluginLoader.module.renderers;
    if (renderers?.length) {
      const pluginDir = path.dirname(pluginLoader.path);
      const resolved: CurvenoteRendererSpec[] = renderers.map((renderer: CurvenoteRendererSpec) => ({
        ...renderer,
        source: path.resolve(pluginDir, renderer.source),
      }));
      session.log.debug(
        `🔌 ${plugin?.name ?? 'Unnamed Plugin'} (${pluginLoader.path}) loaded: ${plural(
          '%s renderer(s)',
          resolved,
        )}`,
      );
      loadedPlugins.renderers.push(...resolved);
    }
    loadedPlugins.checksPaths.push(pluginLoader.path);
  });
  session.log.debug('Project Plugins loaded');
  return loadedPlugins;
}
