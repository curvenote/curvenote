import fs from 'node:fs';
import { configFromPath, defaultConfigFile } from 'myst-cli';
import { writeFileToFolder } from 'myst-cli-utils';
import type { ProjectConfig } from 'myst-config';
import yaml from 'js-yaml';
import type { ISession } from '../../session/types.js';
import { cleanProjectConfigForWrite } from '../utils.js';

/**
 * Write project config to YAML file without data expansion.
 * Safely updates only the 'project' key while preserving all other top-level keys.
 * Reads the file directly without relying on session state.
 *
 * @param session - The session object (only used for config file path resolution)
 * @param path - The path to the project directory
 * @param projectConfig - The cleaned project config to write
 */
export async function writeProjectToTemplateYmlFile(
  session: ISession,
  path: string,
  projectConfig: ProjectConfig,
): Promise<void> {
  const file = configFromPath(session, path) || defaultConfigFile(session, path);

  // Load raw YAML directly from file (no session state dependency)
  let rawConfig: Record<string, any>;
  if (fs.existsSync(file)) {
    rawConfig = yaml.load(fs.readFileSync(file, 'utf-8')) as Record<string, any>;
  } else {
    // New file - start with version
    rawConfig = { version: 1 };
  }

  // Update only the project key with cleaned config
  rawConfig.project = cleanProjectConfigForWrite(projectConfig);

  // Write using yaml.dump with safe options (no data expansion)
  const yamlContent = yaml.dump(rawConfig, {
    lineWidth: -1, // Don't wrap lines
    noRefs: true, // Don't use references
    sortKeys: false, // Keep order
  });

  writeFileToFolder(file, yamlContent, 'utf-8');
  session.log.debug(`Wrote project config to ${file}`);
}
