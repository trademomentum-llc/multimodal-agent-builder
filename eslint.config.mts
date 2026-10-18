import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  { settings: { react: { version: 'detect' } } },
  {
    // TypeScript component props are type-checked by tsc; runtime PropTypes
    // validation is redundant for .ts/.tsx (eslint-plugin-react guidance).
    files: ['**/*.{ts,tsx}'],
    rules: { 'react/prop-types': 'off' },
  },
  {
    // Keep the rule on; only honour the conventional `_` prefix for
    // intentionally-unused parameters (e.g. Express 4-arity error handlers).
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'htmlcov/**'] },
]);
