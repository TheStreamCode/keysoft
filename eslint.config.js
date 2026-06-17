// ESLint 9 flat config. Mirrors the previous .eslintrc.js: the Expo preset plus
// the project's unused-vars rule, with Jest globals scoped to test files.
const expoFlat = require('eslint-config-expo/flat');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const globals = require('globals');

module.exports = [
  ...expoFlat,
  {
    ignores: ['dist/**', 'dist-test/**', '.expo/**', 'web-build/**'],
  },
  {
    files: [
      '**/__tests__/**',
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      'jest.setup.js',
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.d.ts'],
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
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
  },
  {
    // Preserve the previous lint contract: the legacy ESLint 8 config did not
    // enforce these import rules (its resolver did not flag them), so keep them
    // off to avoid introducing churn unrelated to this migration. The `import`
    // plugin is already registered by the Expo preset above.
    rules: {
      'import/no-duplicates': 'off',
      'import/no-named-as-default': 'off',
    },
  },
];
