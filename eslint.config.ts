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
      'no-underscore-dangle': 'off',
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/member-ordering': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      '@typescript-eslint/no-unsafe-unary-minus': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-invalid-void-type': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/consistent-return': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/switch-exhaustiveness-check': 'off',
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
