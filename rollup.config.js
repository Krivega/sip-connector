import typescript from 'rollup-plugin-typescript2';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';

const plugins = [
  commonjs(),
  typescript({
    useTsconfigDeclarationDir: true,
    tsconfigOverride: { exclude: ['**/__tests__/**', '**/setupTests.*'] },
  }),
  terser(),
];

const config = {
  plugins,
  input: pkg['main:src'],
  output: [
    { file: pkg.main, format: 'umd', sourcemap: true, name: 'sipConnector' },
    { file: pkg.module, format: 'es', sourcemap: true },
  ],
};

export default config;
