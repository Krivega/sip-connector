/* eslint-disable import/no-extraneous-dependencies */
import { includeIgnoreFile } from '@eslint/compat';
import { defineConfig } from 'eslint/config';
import nodeUrl from 'node:url';
import configJest from './eslint.config.jest';

const gitignorePath = nodeUrl.fileURLToPath(new URL('.gitignore', import.meta.url));

export default defineConfig([
  includeIgnoreFile(gitignorePath),
  {
    extends: [configJest],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: './',
      },
    },
    rules: {
      '@stylistic/max-len': 'off',
    },
  },
]);
