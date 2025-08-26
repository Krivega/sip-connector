/* eslint-disable import/no-extraneous-dependencies */

import nodeUrl from 'node:url';

import { includeIgnoreFile } from '@eslint/compat';
import config from '@krivega/eslint-config/jest';
import { defineConfig } from 'eslint/config';

const gitignorePath = nodeUrl.fileURLToPath(new URL('.gitignore', import.meta.url));

export default defineConfig([
  includeIgnoreFile(gitignorePath),
  {
    extends: [config],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: nodeUrl.fileURLToPath(new URL('.', import.meta.url)),
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
]);
