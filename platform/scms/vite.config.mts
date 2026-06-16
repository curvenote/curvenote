import type { UserConfig } from 'vite';
import { defineConfig, loadEnv, searchForWorkspaceRoot } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import appConfigVite from '@app-config/vite';
import path from 'path';
import { readFileSync } from 'fs';
import ViteRestart from 'vite-plugin-restart';
import { loadConfig } from '@app-config/main';
import tailwindcss from '@tailwindcss/vite';

const WORKSPACE_ROOT = path.resolve(process.cwd(), '../..');

/** Workspace UI packages resolve to source in dev via package.json "development" exports. */
const WORKSPACE_UI_PATTERNS = [/^@curvenote\//, /^@hhmi\//];

const SERVER_WORKSPACE_PACKAGES = ['@curvenote/scms-server', '@curvenote/scms-db'];

/** optimizeDeps.exclude requires exact package name strings, not RegExp. */
function getWorkspacePackageNames(): string[] {
  const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Object.keys(deps).filter(
    (name) => name.startsWith('@curvenote/') || name.startsWith('@hhmi/'),
  );
}

export default defineConfig(async ({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  await loadConfig(
    {
      environmentOverride: env.VITE_APP_CONFIG_ENV,
      directory: path.resolve(process.cwd(), '.'),
    },
    {
      directory: WORKSPACE_ROOT,
    },
  );

  const userConfig: UserConfig = {
    server: {
      // Listen on all interfaces (0.0.0.0 / ::) so loopback works consistently:
      // `curl http://localhost:…` can use IPv6 while the Pub/Sub emulator’s Java
      // client uses 127.0.0.1 — default host-only bind often refuses one of them.
      host: true,
      port: env.VITE_PORT ? parseInt(env.VITE_PORT) : undefined,
      // Cloudflare tunnel / reverse proxy: Host is the public hostname, not localhost.
      // host.docker.internal: async workers in Docker PATCH job status back to the host SCMS.
      allowedHosts: ['.curvenote.net', 'host.docker.internal', 'localhost'],
      watch: {
        // Polling watches every file under fs.allow and can hit EMFILE on large monorepos.
        usePolling: false,
        ignored: ['**/node_modules/**'],
        interval: 100,
      },
      fs: {
        allow: [searchForWorkspaceRoot(process.cwd()), WORKSPACE_ROOT],
      },
    },
    optimizeDeps: {
      exclude: [
        ...getWorkspacePackageNames(),
        '@google-cloud/storage',
        'jwa',
        'jsonwebtoken',
        'jose',
        'gtoken',
        'google-gax',
        'google-auth-library',
        'firebase-admin',
        'crypto',
      ],
    },
    ssr: {
      external: ['crypto', ...SERVER_WORKSPACE_PACKAGES],
      noExternal: [
        ...WORKSPACE_UI_PATTERNS,
        'lucide-react',
        'clsx',
        /@codemirror\/.*/,
        /@radix-ui\/.*/,
        /@heroicons\/.*/,
        /@headlessui\/.*/,
      ],
    },
    plugins: [
      reactRouter(),
      tsconfigPaths(),
      tailwindcss(),
      (appConfigVite as any).default(), // don't know why the default import is not working
      // Plugin to suppress sourcemap warnings for node_modules packages
      {
        name: 'suppress-sourcemap-warnings',
        enforce: 'pre',
        buildStart() {
          // Suppress sourcemap warnings from node_modules
          // These warnings occur when packages include sourcemap references
          // but don't include the source files in their distribution
          const originalWarn = console.warn;
          console.warn = (...args: any[]) => {
            const message = args[0]?.toString() || '';
            // Filter out sourcemap warnings from node_modules
            if (
              message.includes('Sourcemap for') &&
              message.includes('points to missing source files')
            ) {
              return; // Suppress this warning
            }
            originalWarn.apply(console, args);
          };
        },
      },
      ViteRestart({
        restart: [
          '.app-config.*',
          '../../packages/*/package.json',
          '../../packages/*/tsconfig.json',
          '../../packages/scms-server/dist/index.js',
          '../../ee/*/package.json',
          '../../ee/*/tsconfig.json',
          '../../extensions/*/packages/*/package.json',
          '../../extensions/*/packages/*/tsconfig.json',
        ],
      }),
    ],
    resolve: {
      conditions:
        mode === 'development'
          ? ['development', 'import', 'module', 'default']
          : ['import', 'module', 'default'],
      dedupe: ['react', 'react-dom', 'react-router', '@curvenote/scms-core'],
    },
  };
  return userConfig;
});
