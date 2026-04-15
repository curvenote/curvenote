import echoPlugin from '@curvenote/check-relay-plugin-echo';
import { loadPlugins } from './loader.js';

/**
 * Register all available plugins.
 * Add new plugin imports here as they are created.
 */
export async function registerPlugins(): Promise<void> {
  await loadPlugins([echoPlugin]);
}
