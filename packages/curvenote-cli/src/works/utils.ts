import { selectors } from 'myst-cli';
import type { ISession } from '../session/types.js';

/**
 * Get project.id from the current config file
 *
 * The project.id will be used as journals work key
 *
 * If no config file is found this exits
 * If config file exists but project.id is not defined,
 * this returns undefined.
 */
export function workKeyFromConfig(session: ISession) {
  session.log.debug('Looking for key from config file');
  const state = session.store.getState();
  const projectConfigFile = selectors.selectCurrentProjectFile(state);
  if (!projectConfigFile) {
    session.log.error('No project configuration found');
    process.exit(1);
  }
  session.log.debug(`Found config file: ${projectConfigFile}`);
  const projectConfig = selectors.selectCurrentProjectConfig(state);
  return projectConfig?.id;
}
