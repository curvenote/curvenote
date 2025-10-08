import chalk from 'chalk';
import { loadProjectFromDisk, selectors } from 'myst-cli';
import type { ProjectConfig } from 'myst-config';
import type { ISession } from '../../session/types.js';

// ============================================================================
// PROJECT MODIFICATION HANDLERS
// These functions operate on EXISTING projects (require projectConfig)
// Add new project modification operations here
// ============================================================================

/**
 * Helper to validate that a project config exists
 * Used by project modification operations
 */
export function validateExistingProject(session: ISession, currentPath: string): ProjectConfig {
  const projectConfig = selectors.selectCurrentProjectConfig(session.store.getState());
  if (!projectConfig) {
    throw Error(
      `No project config found at ${currentPath}. Run ${chalk.bold('curvenote init')} first.`,
    );
  }
  return projectConfig;
}

/**
 * Handle --write-toc option: Generate table of contents for existing project
 */
export async function handleWriteTOC(
  session: ISession,
  currentPath: string,
  projectConfig: ProjectConfig,
): Promise<void> {
  if (projectConfig.toc) {
    session.log.warn('Not writing the table of contents, it already exists!');
    return;
  }
  await loadProjectFromDisk(session, currentPath, { writeTOC: true });
}

// Add more project modification handlers here, following the same pattern:
// - export async function handleSomeOption(session, currentPath, projectConfig)
// - Validate preconditions (e.g., check if already exists)
// - Perform the operation
// - Log appropriately
