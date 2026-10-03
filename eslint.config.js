import pluginImport from 'eslint-plugin-import';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import tseslintParser from '@typescript-eslint/parser';

export default [
  // Build output, deps and generated artefacts are never linted.
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'src-tauri/target/**',
      'src-tauri/gen/**',
      '**/*.d.ts',
    ],
  },

  // Application source. Covers ALL of src/ — previously only
  // features/shared/core were matched, leaving src/stores, src/router,
  // src/constants, the window entrypoints (main/App/Composer/ThreadWindow)
  // and the test harness silently unlinted.
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: {
      import: pluginImport,
      'react-hooks': pluginReactHooks,
    },
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // ── Architectural boundaries ───────────────────────────────────────
      // Cross-feature imports must go through shared/ or a service, never
      // sideways into another feature. See AGENTS.md (three-layer rule).
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: 'src/features/tasks/**',
              from: [
                'src/features/mail',
                'src/features/contacts',
                'src/features/campaigns',
                'src/features/deliverability',
              ],
            },
            {
              target: 'src/features/contacts/**',
              from: ['src/features/mail', 'src/features/deliverability', 'src/features/campaigns'],
            },
            {
              target: 'src/features/deliverability/**',
              from: [
                'src/features/mail',
                'src/features/contacts',
                'src/features/campaigns',
                'src/features/tasks',
              ],
            },
            {
              target: 'src/features/campaigns/**',
              from: ['src/features/mail', 'src/features/deliverability', 'src/features/tasks'],
            },
            {
              target: 'src/features/calendar/**',
              from: [
                'src/features/contacts',
                'src/features/campaigns',
                'src/features/deliverability',
                'src/features/tasks',
              ],
            },
            {
              target: 'src/features/accounts/**',
              from: [
                'src/features/contacts',
                'src/features/campaigns',
                'src/features/deliverability',
                'src/features/tasks',
              ],
            },
            {
              target: 'src/features/mail/**',
              from: ['src/features/campaigns', 'src/features/calendar'],
            },
            {
              target: 'src/features/settings/**',
              from: [
                'src/features/campaigns',
                'src/features/calendar',
                'src/features/contacts',
                'src/features/tasks',
              ],
            },
            {
              target: 'src/features/shared/**',
              from: [
                'src/features/tasks',
                'src/features/contacts',
                'src/features/deliverability',
                'src/features/campaigns',
                'src/features/calendar',
                'src/features/accounts',
                'src/features/mail',
                'src/features/settings',
              ],
            },
          ],
        },
      ],
    },
  },

  // Test files: relax hook-dependency noise, they drive mocks on purpose.
  {
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/test/**/*.ts'],
    rules: {
      'react-hooks/exhaustive-deps': 'off',
    },
  },
];
