import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // libauth initialises its WebAssembly crypto with top-level await.
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
  optimizeDeps: {
    esbuildOptions: { target: 'es2022' },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
});
