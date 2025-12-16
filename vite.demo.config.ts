import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'demoDist',
    },
    plugins: [basicSsl(), tsConfigPaths()],
  };
});
