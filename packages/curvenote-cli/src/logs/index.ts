import { getGitRepoInfo } from '../submissions/utils.git.js';
import type { BaseLog } from './types.js';

export * from './types.js';

export async function addSourceToLogs<T extends BaseLog>(logs: T): Promise<T> {
  const gitInfo = await getGitRepoInfo();
  logs.source = {
    repo: gitInfo?.repo,
    branch: gitInfo?.branch,
    path: gitInfo?.path,
    commit: gitInfo?.commit,
  };
  return logs;
}
