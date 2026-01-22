module.exports = {
  root: true,
  // This tells ESLint to load the config from the package `eslint-config-curvenote`
  extends: ['curvenote'],
  // Ignore patterns for the monorepo
  // Each package/app has its own .eslintrc.cjs that will handle its specific files
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.turbo/',
    '*.config.js',
    '*.config.cjs',
    '*.config.mjs',
  ],
};
