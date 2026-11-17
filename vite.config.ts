import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  // The keeper (vite build --ssr keeper/cli.ts) is a Node program: no public assets.
  publicDir: isSsrBuild ? false : 'public',
  build: {
    emptyOutDir: false,
    // libauth initialises its WebAssembly crypto with top-level await.
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
}));
