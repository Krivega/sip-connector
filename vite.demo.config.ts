import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'demoDist',
    },
    plugins: [tsConfigPaths()],
    server: {
      https: {
        key: './.cert/key.pem',
        cert: './.cert/cert.pem',
      },
      host: true,
      cors: false,
    },
  };
});
