import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';

/**
 * Resolves a relative path from the current file to a path that Vite/React Router can understand.
 * This allows you to use relative paths in route definitions from external modules/packages.
 *
 * For files inside the app/ directory: Returns a path relative to app/
 * For files outside the app/ directory: Returns a path relative to app/ (e.g., ../../packages/...)
 *
 * @param currentFileUrl - The import.meta.url from the calling file
 * @param relativePath - The relative path from the current file (e.g., "./routes/file.tsx")
 * @param options - Configuration options
 * @param options.appDir - Explicit app directory path. If not provided, will be auto-detected.
 * @returns A path that can be used with React Router's route() function
 *
 * @example
 * ```ts
 * // In packages/my-extension/src/routes.ts
 * import { resolveRoutePath } from '@curvenote/scms-core';
 *
 * route("compliance", resolveRoutePath(import.meta.url, "./routes/compliance.tsx"))
 * ```
 */
export function resolveRoutePath(
  currentFileUrl: string | URL,
  relativePath: string,
  options: {
    appDir?: string;
  } = {},
): string {
  const { appDir: providedAppDir } = options;
  const currentFilePath = fileURLToPath(currentFileUrl);
  const currentDir = dirname(currentFilePath);

  // Check if we're in a dist/ directory (compiled package)
  // If so, resolve relative to the corresponding src/ directory instead
  let resolveDir = currentDir;
  const distIndex = currentDir.indexOf('/dist');
  const distIndexWin = currentDir.indexOf('\\dist');
  if (distIndex !== -1 || distIndexWin !== -1) {
    // Find the index (handle both Unix and Windows paths)
    const index = distIndex !== -1 ? distIndex : distIndexWin;
    // Replace dist with src at this position
    resolveDir =
      currentDir.substring(0, index) +
      currentDir.substring(index).replace(/dist([/\\]|$)/g, 'src$1');
  }

  // Resolve the absolute path from the resolved directory
  let absolutePath = resolve(resolveDir, relativePath);

  // Double-check: if the resolved path still contains /dist/, replace it with /src/
  // This handles cases where the relativePath itself might reference dist/
  if (absolutePath.includes('/dist/') || absolutePath.includes('\\dist\\')) {
    absolutePath = absolutePath.replace(/dist([/\\])/g, 'src$1');
  }

  // Find the app directory
  let appDir: string | null = providedAppDir ? resolve(providedAppDir) : null;

  if (!appDir) {
    // Try to find app/ by walking up from the current file
    let searchDir = currentDir;
    while (searchDir !== dirname(searchDir)) {
      if (searchDir.endsWith('app') || searchDir.endsWith('app/')) {
        appDir = searchDir;
        break;
      }
      searchDir = dirname(searchDir);
    }
  }

  // Fallback: assume app/ is at process.cwd()/app
  if (!appDir) {
    appDir = resolve(process.cwd(), 'app');
  }

  // Normalize paths
  const normalizedAppDir = resolve(appDir);
  const normalizedAbsolutePath = resolve(absolutePath);
  const appRelativePath = relative(normalizedAppDir, normalizedAbsolutePath);
  return appRelativePath.replace(/\\/g, '/');
}
