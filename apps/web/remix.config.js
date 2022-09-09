/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  serverBuildTarget: 'vercel',
  // When running locally in development mode, we use the built in remix
  // server. This does not understand the vercel lambda module format,
  // so we default back to the standard build output.
  server: process.env.NODE_ENV === 'development' ? undefined : './server.js',
  ignoredRouteFiles: ['.*'],
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  // serverBuildPath: "api/index.js",
  // publicPath: "/build/",
  // devServerPort: 8002,
  serverDependenciesToBundle: [
    /^rehype.*/,
    /^remark.*/,
    /^unified.*/,
    /^unist.*/,
    'bail',
    'is-plain-obj',
    'trough',
    'zwitch',
    /^vfile.*/,
    'myst-to-react',
    '@curvenote/ui-providers',
    '@curvenote/icons',
    '@curvenote/site',
    '@curvenote/site-common',
    'react-syntax-highlighter',
    '@jupyterlab/rendermime',
    '@jupyterlab/rendermime-interfaces',
  ],
  watchPaths: ['../../packages/**/*'],
};
