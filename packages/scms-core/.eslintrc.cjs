module.exports = {
  root: true,
  extends: ['curvenote'],
  rules: {
    // Allow React.forwardRef(function ComponentName ...) which shadows the outer const.
    '@typescript-eslint/no-shadow': 'off',
  },
};
