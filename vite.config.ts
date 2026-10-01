import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const host = process.env.TAURI_DEV_HOST;

// Vite 8 runs on Rolldown/Oxc. Two things it is strict about:
//   - `manualChunks` must be a FUNCTION (an object throws at build time)
//   - the alias table below must stay in sync with tsconfig.json `paths`
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
      '@core': path.resolve(rootDir, './src/core'),
      '@features': path.resolve(rootDir, './src/features'),
      '@shared': path.resolve(rootDir, './src/shared'),
      '@test': path.resolve(rootDir, './src/test'),
    },
  },
  // Tauri ships a known Chromium/WebKit; targeting it avoids downlevelling
  // modern syntax we do not need to transpile.
  build: {
    // Both entry points are real windows in the Tauri app.
    rollupOptions: {
      input: {
        main: path.resolve(rootDir, 'index.html'),
        splashscreen: path.resolve(rootDir, 'splashscreen.html'),
      },
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return;
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('prosemirror-')) return 'vendor-editor';
          if (id.includes('i18next') || id.includes('react-i18next')) return 'vendor-i18n';
          if (
            // Precise: only the react / react-dom package directories.
            // A loose 'node_modules/react' match would also capture
            // @tiptap/react and @xyflow/react, dragging lazy feature code
            // into this eager chunk (+232 kB measured).
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('@tanstack/react-router')
          )
            return 'vendor-react';
        },
      },
    },
    // The app is large; the default 500 kB warning fires on every build and
    // hides genuinely new regressions. Raised so the warning stays meaningful.
    chunkSizeWarningLimit: 2000,
    sourcemap: process.env.TAURI_ENV_DEBUG === 'true',
  },
  // Keep the esbuild-era dependency pre-bundling deterministic under Rolldown.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-i18next', 'i18next', 'zustand'],
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
