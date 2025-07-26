import path from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import tsConfigPaths from 'vite-tsconfig-paths';

import packageJson from './package.json';

const externalDependencies = [
  ...Object.keys(packageJson.peerDependencies),
  '@krivega/jssip/lib/URI',
  '@krivega/jssip/lib/SIPMessage',
  '@krivega/jssip/lib/NameAddrHeader',
  'node:events',
];

export default defineConfig(() => {
  return {
    publicDir: false,
    plugins: [
      tsConfigPaths(),
      dts({
        entryRoot: 'src',
        include: ['src'],
        exclude: ['src/setupTests.ts', 'src/**/__tests__/**'],
      }),
    ],
    build: {
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
