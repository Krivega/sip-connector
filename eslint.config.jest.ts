/* eslint-disable import/no-extraneous-dependencies */
import type { Linter } from 'eslint';
import pluginJest from 'eslint-plugin-jest';
import config from './eslint.config.base';

const jestConfig: Linter.Config[] = [
  ...config,
  {
    files: ['**/*.spec.js', '**/*.test.js', '**/__tests__/**/*.ts', '**/__tests__/**/*.tsx'],
    plugins: { jest: pluginJest },
    languageOptions: {
      globals: pluginJest.environments.globals.globals,
    },
    rules: {
      ...pluginJest.configs['flat/recommended'].rules,
      '@typescript-eslint/unbound-method': 'off',
    },
  },
];

export default jestConfig;
