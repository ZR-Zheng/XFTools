import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { normalizePath } from 'vite';
import packageJson from './package.json' with { type: 'json' };
const require = createRequire(import.meta.url);
// React-PDF must load a worker from its own PDF.js version, which may differ from the standalone tools.
const reactPdfWorker = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs', {
  paths: [dirname(require.resolve('react-pdf'))]
});
export default defineConfig({
  plugins: [
    {
      name: 'filerobot-react-import',
      enforce: 'pre',
      transform(code, id) {
        // These Filerobot 5.0.1 components use React.createElement without importing React.
        if (/\/react-filerobot-image-editor\/lib\/components\/(?:buttons\/HistoryButtons\/HistoryButtons|Tabs\/TabsResponsive|Tabs\/TabsNavbar\/index)\.js$/.test(id.replace(/\\/g, '/'))) {
          return { code: "import React from 'react';\n" + code, map: null };
        }
      }
    },
    react(),
    tailwindcss()
  ],
  resolve: {
    tsconfigPaths: true,
    alias: { '@react-pdf-worker': normalizePath(dirname(reactPdfWorker)) }
  },
  define: {
    'process.env': {},
    __APP_VERSION__: JSON.stringify(packageJson.version)
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', 'react-filerobot-image-editor']
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
