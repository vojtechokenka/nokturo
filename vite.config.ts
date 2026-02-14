import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Načti .env pro build
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

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(require('./package.json').version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    // Explicitně definuj env pro build (fallback na process.env)
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://lzgophszvombxpfkiioc.supabase.co'
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      env.VITE_SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6Z29waHN6dm9tYnhwZmtpaW9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODE3NTksImV4cCI6MjA4NjA1Nzc1OX0.1I3uZB-X3pC9ptxslpgkJMYnu8USQLi8yY3bg82E8rw'
    ),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
});
