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
  // Legacy exceptions: each React Compiler rule is disabled only for the
  // specific files that currently violate it. These narrow overrides must be
  // removed as the listed files are refactored to comply.
  {
    files: [
      'src/components/CustomAlert.tsx',
      'src/components/ScreenWrapper.tsx',
      'src/components/ui/bottom-sheet.tsx',
      'src/screens/OnboardingScreen.tsx',
    ],
    rules: {
      'react-hooks/refs': 'off',
    },
  },
  {
    files: [
      'src/contexts/ThemeContext.tsx',
      'src/hooks/settings/useNotificationSettings.ts',
      'src/hooks/settings/useProfileForm.ts',
      'src/hooks/useHomeLogic.ts',
      'src/screens/AuthScreen.tsx',
      'src/screens/PasswordDetailScreen.tsx',
      'src/screens/PasswordGeneratorScreen.tsx',
      'src/screens/SettingsScreen.tsx',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: [
      'src/contexts/AuthContext.tsx',
      'src/screens/AuthScreen.tsx',
    ],
    rules: {
      'react-hooks/immutability': 'off',
    },
  },
  {
    files: ['src/contexts/AuthContext.tsx'],
    rules: {
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
  {
    files: ['src/screens/OnboardingScreen.tsx'],
    rules: {
      'react-hooks/error-boundaries': 'off',
    },
  },
  {
    files: ['src/screens/PasswordDetailScreen.tsx'],
    rules: {
      'react-hooks/purity': 'off',
    },
  },
];
