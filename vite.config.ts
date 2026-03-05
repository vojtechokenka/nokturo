import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = path.resolve(__dirname, '.env');
const env = fs.existsSync(envFile)
  ? Object.fromEntries(
      fs
        .readFileSync(envFile, 'utf-8')
        .split('\n')
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.split('='))
        .map(([key, ...values]) => [key.trim(), values.join('=').trim()])
    )
  : {};

const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
const packageVersion = packageJson.version;

// PWA manifest a ikony musí zůstat na rootu (/manifest.json, /icons/) — Vite s base /app/ je přepisuje
// Cache-busting ?v=VERSION pro ikony (web + PWA)
function fixPwaPathsPlugin() {
  const v = `?v=${packageVersion}`;
  return {
    name: 'fix-pwa-paths',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html
          .replace('href="/app/manifest.json"', `href="/manifest.json${v}"`)
          .replace('href="/app/icons/icon-192.png"', `href="/icons/icon-192.png${v}"`)
          .replace('href="icon_32.png"', `href="icon_32.png${v}"`);
      },
    },
    writeBundle(_, bundle) {
      const manifestPath = path.resolve(__dirname, 'dist', 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        if (manifest.icons) {
          manifest.icons = manifest.icons.map((i) => ({
            ...i,
            src: i.src.includes('?') ? i.src : `${i.src}${v}`,
          }));
          fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), fixPwaPathsPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(packageVersion),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    // Explicitně definuj env pro build (fallback na process.env pro Vercel)
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
    ),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // base je './' pro Electron (default), přepíše se přes CLI: --base /app/ pro web build
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: false,
  },
});
