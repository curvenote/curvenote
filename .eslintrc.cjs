module.exports = {
  root: true,
  // This tells ESLint to load the config from the package `eslint-config-curvenote`
  extends: ['curvenote'],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.turbo/',
    '*.config.js',
    '*.config.cjs',
    '*.config.mjs',
    '**/*.d.ts',
  ],
  rules: {
    // Allow React.forwardRef(function ComponentName ...) which shadows the outer const.
    '@typescript-eslint/no-shadow': 'off',
  },
};
