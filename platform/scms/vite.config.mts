import type { UserConfig } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import appConfigVite from '@app-config/vite';
import { createRequire } from 'module';
import path from 'path';
import ViteRestart from 'vite-plugin-restart';
import { loadConfig } from '@app-config/main';
// import builtins from 'rollup-plugin-node-builtins';

const require = createRequire(import.meta.url);
const prismaClientDirectory = path.normalize(
  path.relative(
    process.cwd(),
    require.resolve('@prisma/client').replace(/@prisma(\/|\\)client(\/|\\).*/, '.prisma/client'),
  ),
);

const prismaIndexBrowserPath = path.join(prismaClientDirectory, 'index-browser.js');

// const builtinsPlugin = builtins({ crypto: true });
// builtinsPlugin.name = 'builtins';

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
   * This config enables hot module reload (HMR) for changes in local packages:
   * - Watches package source directories for changes
   * - Excludes local packages from pre-bundling for faster updates
   * - Processes local packages through Vite's SSR transform
   * - Restarts dev server when package configuration changes
   */
  const userConfig: UserConfig = {
    server: {
      port: env.VITE_PORT ? parseInt(env.VITE_PORT) : undefined,
      // Watch package source files for changes to enable hot reload
      watch: {
        // Explicitly watch all files in packages directory (use ** for recursive matching)
        // The negation pattern (!) means "don't ignore this"
        ignored: [
          // Don't ignore any files in packages - watch everything recursively
          '!**/packages/**',
        ],
        // Use polling for better reliability with TypeScript file changes
        // This ensures enum/type changes are picked up immediately
        usePolling: false, // Set to true if file watching is unreliable
        // Increase interval for polling if enabled
        interval: 100,
      },
      // Allow Vite to serve files from the workspace root and packages
      fs: {
        allow: [
          // Workspace root
          process.cwd(),
          // Allow access to all packages
          path.join(process.cwd(), 'packages'),
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
      ],
      esbuildOptions: {
        // Configure esbuild to handle crypto imports during dependency optimization
        // Mark crypto as external to prevent resolving the deprecated npm package
        // During optimizeDeps, we're in client mode, so we can use node:crypto
        plugins: [
          {
            name: 'crypto-to-node-crypto',
            setup(build) {
              build.onResolve({ filter: /^crypto$/ }, () => {
                // For optimizeDeps (client-side), redirect to node:crypto
                return { path: 'node:crypto', external: true };
              });
            },
          },
        ],
      },
      force: true,
    },
    ssr: {
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
      (appConfigVite as any).default(), // don't know why the default import is not working
      ViteRestart({
        restart: [
          '.app-config.*',
          // Restart when package.json files change in any package
          'packages/*/package.json',
          // Restart when tsconfig files change in packages (affects types)
          'packages/*/tsconfig.json',
        ],
      }),
      // Plugin to invalidate modules when TypeScript files change (e.g., enum updates)
      // This ensures enum/type changes in packages are picked up immediately without rebuild
      {
        name: 'invalidate-on-typescript-changes',
        configureServer(server) {
          // Watch TypeScript files in packages and trigger HMR when they change
          server.watcher.on('change', (file) => {
            if (file.includes('packages/') && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
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
      // Plugin to handle crypto imports and exclude server-only packages from client builds
      {
        name: 'fix-crypto-imports',
        enforce: 'pre',
        resolveId(id, importer, options) {
          // Detect SSR mode - check multiple indicators
          const isSSR =
            options?.ssr === true ||
            (importer &&
              (importer.includes('virtual:react-router') ||
                importer.includes('ssr') ||
                importer.includes('server-build')));

          // Server-only packages that should never be processed for client
          const serverOnlyPackages = [
            '@curvenote/scms-server',
            '@google-cloud/storage',
            '@google-cloud/pubsub',
            'google-auth-library',
            'firebase-admin',
          ];

          // Check if the ID itself is a server-only package
          const isServerOnlyPackageId = serverOnlyPackages.some((pkg) => id.includes(pkg));

          // For client builds, mark server-only packages as external immediately
          if (!isSSR && isServerOnlyPackageId) {
            return {
              id,
              external: true,
            };
          }

          // Handle 'node:crypto' imports first (most common in built packages)
          if (id === 'node:crypto') {
            if (isSSR) {
              // Convert node:crypto back to crypto for SSR (Vite's SSR loader can't handle node: protocol)
              return {
                id: 'crypto',
                external: true,
              };
            } else {
              // For client builds, always convert to crypto and mark external
              // This prevents Vite from trying to load node:crypto in the browser
              return {
                id: 'crypto',
                external: true,
              };
            }
          }

          // Handle 'crypto' imports
          if (id === 'crypto' && !id.startsWith('node:') && !id.startsWith('.')) {
            if (isSSR) {
              // For SSR, just mark as external - Node.js will handle it natively
              return {
                id: 'crypto',
                external: true,
              };
            } else {
              // For client builds, always mark as external
              // Server-only packages shouldn't be processed for client anyway
              return {
                id: 'crypto',
                external: true,
              };
            }
          }

          return null;
        },
        // Intercept loading of files to prevent Vite from processing server-only packages
        load(id) {
          // Only intercept in client mode (not SSR)
          const serverOnlyPackages = [
            '@curvenote/scms-server',
            '@google-cloud/storage',
            '@google-cloud/pubsub',
            'google-auth-library',
            'firebase-admin',
          ];

          // Check if this is a server-only package file
          const isServerOnlyFile = serverOnlyPackages.some((pkg) => id.includes(pkg));

          if (isServerOnlyFile && !id.includes('virtual:') && !id.includes('node_modules/.vite')) {
            // Return an empty module to prevent Vite from processing it
            // The resolveId hook should have already marked it as external
            return {
              code: '// Server-only module - skipped in client build',
              map: null,
            };
          }

          return null;
        },
      },
    ],
    resolve: {
      alias: {
        '.prisma/client/index-browser': prismaIndexBrowserPath,
        '@': path.resolve(__dirname, './src'),
        http: 'node:http',
      },
      // Dedupe these packages to avoid multiple instances
      dedupe: ['react', 'react-dom', 'react-router'],
    },
    build: {
      rollupOptions: {
        // plugins: [builtinsPlugin],
        external: [
          '@google-cloud/storage',
          'jwa',
          'jsonwebtoken',
          'jose',
          'gtoken',
          'google-gax',
          'google-auth-library',
          'firebase-admin',
          'crypto',
          '@curvenote/scms-server',
        ],
      },
    },
  };
  return userConfig;
});
