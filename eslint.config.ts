import { fileURLToPath } from 'node:url';

import config from '@krivega/eslint-config/jest';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    extends: [config],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    rules: {
      '@stylistic/max-len': 'off',
      'unicorn/filename-case': 'off',
    },
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/build/**',
      '**/.git/**',
      '**/public/**',
      '!.eslintrc.js',
      'package.json',
      'jsconfig.json',
      'manifest.json',
      '**/CHANGELOG.md',
      '**/.next/**',
      '**/.cache/**',
      '**/static/**',
      '**/*.min.js',
      '**/*.bundle.js',
      '**/generated/**',
      '**/__snapshots__/**',
      '**/tmp/**',
      '**/temp/**',
      '**/assets/**',
      '**/vendor/**',
    ],
  },
  {
    files: ['e2e/**'],
    rules: {
      'import/no-extraneous-dependencies': 'off',
    },
  },
]);
