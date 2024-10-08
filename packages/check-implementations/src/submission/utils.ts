import type { ISession } from 'myst-cli';
import type { ProjectConfig } from 'myst-config';
import { loadProjectFromDisk, selectFile, selectors } from 'myst-cli';
import isEqual from 'lodash.isequal';

export async function getFrontmatter(
  session: ISession,
  prop: string,
): Promise<{ file: string; config: ProjectConfig }> {
  const { file: indexFile } = await loadProjectFromDisk(session);
  const pageFrontmatter = selectFile(session, indexFile)?.frontmatter ?? {};
  const state = session.store.getState();
  const configFile = selectors.selectCurrentProjectFile(state) as string;
  const projectFrontmatter = selectors.selectLocalProjectConfig(state, '.') ?? {};
  // This isn't awesome as some IDs can be different
  const same = isEqual((pageFrontmatter as any)[prop], (projectFrontmatter as any)[prop]);
  if (
    // Only in the article
    (prop in pageFrontmatter && !(prop in projectFrontmatter)) ||
    // In both, but not the same so it is overwritten with page
    (prop in pageFrontmatter && prop in projectFrontmatter && !same)
  ) {
    return { file: indexFile, config: pageFrontmatter };
  }
  if (
    // Only in the project
    (!(prop in pageFrontmatter) && prop in projectFrontmatter) ||
    // In both, but the same, so copied from project
    (prop in pageFrontmatter && prop in projectFrontmatter && same)
  ) {
    return { file: configFile, config: projectFrontmatter };
  }
  // Fallback to the project
  return { file: configFile, config: projectFrontmatter };
}
