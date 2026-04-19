import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../static',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/renders': 'http://localhost:8000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setup-tests.ts'],
  },
});
