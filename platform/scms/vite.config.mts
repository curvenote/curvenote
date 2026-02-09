import type { UserConfig } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import appConfigVite from '@app-config/vite';
import path from 'path';
import ViteRestart from 'vite-plugin-restart';
import { loadConfig } from '@app-config/main';
import tailwindcss from '@tailwindcss/vite';

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
      directory: path.resolve(process.cwd(), '../../'),
    },
  );
  // TODO need to respect the allowLogin flag whilst allowing linking

  /**
   * Monorepo-optimized Vite configuration
   *
   * This config enables hot module reload (HMR) for changes in local packages and ee:
   * - Watches package and ee source directories for changes
   * - Excludes local packages from pre-bundling for faster updates
   * - Processes local packages through Vite's SSR transform
   * - Restarts dev server when package configuration changes
   */
  const userConfig: UserConfig = {
    server: {
      port: env.VITE_PORT ? parseInt(env.VITE_PORT) : undefined,
      // Watch package and ee source files for changes to enable hot reload
      watch: {
        // Explicitly watch all files in packages and ee directories (use ** for recursive matching)
        // The negation pattern (!) means "don't ignore this"
        ignored: [
          // Don't ignore any files in packages - watch everything recursively
          '!**/packages/**',
          // Don't ignore any files in ee - watch everything recursively
          '!**/ee/**',
        ],
        // Use polling for better reliability with TypeScript file changes
        // This ensures enum/type changes are picked up immediately
        usePolling: false, // Set to true if file watching is unreliable
        // Increase interval for polling if enabled
        interval: 100,
      },
      // Allow Vite to serve files from the workspace root, packages, and ee
      fs: {
        allow: [
          // Workspace root (current directory when running from platform/scms)
          process.cwd(),
          // Allow access to all packages (go up to workspace root, then into packages)
          path.resolve(process.cwd(), '../../packages'),
          // Allow access to ee folder (go up to workspace root, then into ee)
          path.resolve(process.cwd(), '../../ee'),
        ],
      },
    },
    optimizeDeps: {
      exclude: [
        '@google-cloud/storage',
        'jwa',
        'jsonwebtoken',
        'jose',
        'gtoken',
        'google-gax',
        'google-auth-library',
        'firebase-admin',
        'crypto',
        // Exclude all local packages from pre-bundling for faster HMR
        '@curvenote/scms-server',
        '@curvenote/scms-core',
        '@curvenote/scms-db',
      ],
    },
    ssr: {
      external: ['crypto', '@curvenote/scms-server', '@curvenote/scms-db'],
      noExternal: [
        'lucide-react',
        'clsx',
        /@codemirror\/.*/,
        /@radix-ui\/.*/,
        /@heroicons\/.*/,
        /@headlessui\/.*/,
        // Include local packages so they're processed by Vite's SSR transform
        // This enables hot reload for changes in these packages
        '@curvenote/scms-core',
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
          // Restart when package.json files change in any package
          'packages/*/package.json',
          // Restart when tsconfig files change in packages (affects types)
          'packages/*/tsconfig.json',
          // Restart when package.json or tsconfig files change in ee
          'ee/*/package.json',
          'ee/*/tsconfig.json',
        ],
      }),
      // Plugin to invalidate modules when TypeScript files change (e.g., enum updates)
      // This ensures enum/type changes in packages and ee are picked up immediately without rebuild
      {
        name: 'invalidate-on-typescript-changes',
        configureServer(server) {
          // Watch TypeScript files in packages and ee, trigger HMR when they change
          server.watcher.on('change', (file) => {
            if (
              (file.includes('packages/') || file.includes('ee/')) &&
              (file.endsWith('.ts') || file.endsWith('.tsx'))
            ) {
              // Find the module and invalidate it along with all dependents
              const module = server.moduleGraph.getModuleById(file);
              if (module) {
                // Invalidate the module itself
                server.moduleGraph.invalidateModule(module);
                // Invalidate all modules that import this one (to pick up type changes)
                module.importers.forEach((importer) => {
                  server.moduleGraph.invalidateModule(importer);
                });
                // Send HMR update to clients
                server.ws.send({
                  type: 'update',
                  updates: [
                    {
                      type: 'js-update',
                      path: file,
                      acceptedPath: file,
                      timestamp: Date.now(),
                    },
                  ],
                });
              }
            }
          });
        },
      },
    ],
    resolve: {
      // Dedupe these packages to avoid multiple instances
      dedupe: ['react', 'react-dom', 'react-router'],
      alias:
        mode === 'production'
          ? {
              http: 'node:http',
              '@hhmi/checks-proofig/client': path.resolve(
                __dirname,
                '../../extensions/hhmi-checks/packages/checks-proofig/dist/client.js',
              ),
              '@hhmi/checks-proofig': path.resolve(
                __dirname,
                '../../extensions/hhmi-checks/packages/checks-proofig/dist/index.js',
              ),
            }
          : {
              http: 'node:http',
              '@hhmi/checks-proofig/client': path.resolve(
                __dirname,
                '../../extensions/hhmi-checks/packages/checks-proofig/src/client.ts',
              ),
              '@hhmi/checks-proofig': path.resolve(
                __dirname,
                '../../extensions/hhmi-checks/packages/checks-proofig/src/index.ts',
              ),
            },
    },
  };
  return userConfig;
});
