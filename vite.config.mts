import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { normalizePath } from 'vite';
const require = createRequire(import.meta.url);
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@onnxruntime-wasm': normalizePath(
        dirname(require.resolve('onnxruntime-web/wasm'))
      )
    }
  },
  define: {
    'process.env': {}
  },
  optimizeDeps: {
    include: ['@cornerstonejs/codec-openjpeg/wasmjs'],
    exclude: [
      '@ffmpeg/ffmpeg',
      '@ffmpeg/util',
      '@onnxruntime-wasm',
      'onnxruntime-web/wasm',
      'pdfjs-dist/build/pdf.worker.min.mjs?url'
    ]
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: '.vitest/setup',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.tmp/**', 'dist/**']
  },
  worker: { format: 'es' }
});
