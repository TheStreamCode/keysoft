module.exports = {
  extends: 'expo',
  env: {
    jest: true,
  },
  ignorePatterns: ['dist', 'dist-test', '.expo', 'node_modules', 'web-build'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
  },
};
