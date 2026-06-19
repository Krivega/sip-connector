import path from 'node:path';

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

import packageJson from './package.json';

const externalDependencies = [
  ...Object.keys(packageJson.peerDependencies),
  '@krivega/jssip/lib/URI',
  '@krivega/jssip/lib/SIPMessage',
  '@krivega/jssip/lib/NameAddrHeader',
  'node:events',
];

export default defineConfig(() => {
  process.env.VITE_APP_VERSION = packageJson.version;

  return {
    publicDir: false,
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      dts({
        entryRoot: 'src',
        exclude: [
          'src/setupTests.ts',
          'src/**/__tests__/**',
          'src/**/__tests-utils__/**',
          'src/**/__mocks__/**',
          'src/*/**/__fixtures__/**',
          'demo/**',
          'e2e/**',
          'eslint.config.ts',
          'jest.config.ts',
          'vite.config.ts',
          'vite.demo.config.ts',
        ],
      }),
    ],
    build: {
      emptyOutDir: true,
      lib: {
        entry: [path.resolve('src', 'index.ts'), path.resolve('src', 'doMock.ts')],
        name: 'index',
        formats: ['es', 'cjs'],
        fileName: (format, entryName) => {
          return `${entryName}.${format === 'cjs' ? 'cjs' : 'js'}`;
        },
        target: 'esnext',
      },
      rollupOptions: {
        // make sure to externalize deps that shouldn't be bundled
        // into your library
        external: externalDependencies,
      },
      optimizeDeps: {
        exclude: externalDependencies,
      },
      minify: true,
      esbuild: {
        minify: true,
      },
    },
  };
});
