module.exports = {
  root: true,
  extends: ['curvenote'],
  ignorePatterns: ['**/*.d.ts'],
  rules: {
    // Allow React.forwardRef(function ComponentName ...) which shadows the outer const.
    '@typescript-eslint/no-shadow': 'off',
    'prettier/prettier': 'off',
  },
};

