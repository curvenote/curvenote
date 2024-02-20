import fs from 'node:fs';
import path from 'node:path';
import { resolveRef, currentBranch, findRoot, getConfig } from 'isomorphic-git';

function getNormalizedUrl(gitRemoteUrl: string) {
  return gitRemoteUrl
    .replace(/^[a-zA-Z]+:\/\//, '') // Remove protocols (http, https, git, etc.)
    .replace(/^git@/, '') // Remove 'git@' used in SSH URLs
    .replace(/:/, '/'); // Replace ':' with '/' used in SSH URLs
}

function createKeyString(gitRemoteUrl: string, relativePath: string): string {
  // Normalize the Git URL to remove protocol information and SSH-specific parts
  const normalizedUrl = getNormalizedUrl(gitRemoteUrl);

  // Ensure the relative path doesn't include './' for root directory
  const normalizedPath = relativePath === '.' ? '' : relativePath;

  // Construct and return the locator string
  // Format: "normalizedUrl:branchName:relativePath"
  // Note: If the path is the root directory, it ends up as "normalizedUrl:branchName"
  return `${normalizedUrl}${normalizedPath ? ':' + normalizedPath : ''}`;
}

export async function getGitRepoInfo() {
  const loc = process.cwd();

  try {
    const dir = await findRoot({ fs, filepath: loc });

    const [sha, branch, repo] = await Promise.all([
      resolveRef({ fs, dir, ref: 'HEAD' }),
      currentBranch({ fs, dir, test: true }),
      getConfig({ fs, dir, path: 'remote.origin.url' }),
    ]);

    const rel = path.relative(dir, loc);

    return {
      sha,
      commit: sha.slice(0, 7),
      branch: branch || 'HEAD',
      repo: getNormalizedUrl(repo),
      path: rel,
      key: createKeyString(repo, rel),
    };
  } catch (e) {
    return null;
  }
}
