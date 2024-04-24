module.exports = {
  root: true,
  extends: ['curvenote'],
  rules: {
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['**/*.spec.ts'],
      },
    ],
  },
};
