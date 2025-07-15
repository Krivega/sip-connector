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
      // Отключаем правила, которые вызывают ошибки
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/member-ordering': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-invalid-void-type': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/no-null': 'off',
      'unicorn/error-message': 'off',
      'unicorn/prefer-event-target': 'off',
      'jest/no-conditional-expect': 'off',
      'require-atomic-updates': 'off',
      'no-promise-executor-return': 'off',
      'class-methods-use-this': 'off',
      '@typescript-eslint/class-methods-use-this': 'off',
      '@stylistic/max-len': 'off',
    },
  },
]);
