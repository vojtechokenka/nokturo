import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Načti .env pro build (na Vercelu .env neexistuje — env je v process.env)
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

// Načti verzi z package.json (CJS require funguje v Vite config)
const packageVersion = require('./package.json').version;

export default defineConfig({
  plugins: [react()],
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
