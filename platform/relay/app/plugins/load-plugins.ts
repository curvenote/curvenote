import echoPlugin from '@checks-relay/check-service-plugin-echo';
import { loadPlugins } from './loader.js';

/**
 * Register all available plugins.
 * Add new plugin imports here as they are created.
 */
export async function registerPlugins(): Promise<void> {
  await loadPlugins([echoPlugin]);
}
