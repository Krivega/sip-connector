import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';

/** Non-root base for static hosts (e.g. GitHub Pages project site). Set via DEMO_BASE in CI. */
function resolveDemoBase(): string {
  const fromEnv = process.env.DEMO_BASE?.trim();

  if (fromEnv !== undefined) {
    return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`;
  }

  return '/';
}

export default defineConfig(() => {
  return {
    base: resolveDemoBase(),
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
