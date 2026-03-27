import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  plugins: [react()],
  base: isDev ? '/' : './',  // ← '/' em dev, './' só no build
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      host: 'localhost',
      port: 5173,
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});