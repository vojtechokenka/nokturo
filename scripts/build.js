/**
 * Build Nokturo (local build, no publish).
 * Uses GITHUB_OWNER and GITHUB_REPO for app-update.yml (auto-updater).
 * If not set, falls back to package.json values.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const owner = process.env.GITHUB_OWNER || 'vojtechokenka';
const repo = process.env.GITHUB_REPO || 'nokturo';

// 1. Generate icon
console.log('[1/3] Generating icon...');
execSync('node scripts/generate-icon.js', { cwd: root, stdio: 'inherit' });

// 2. Vite build
console.log('[2/3] Building Vite...');
execSync('vite build', { cwd: root, stdio: 'inherit' });

// 3. Electron builder (with publish config for app-update.yml)
console.log('[3/3] Building Electron...');
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const buildConfig = {
  ...pkg.build,
  publish: { provider: 'github', owner, repo },
};

require('electron-builder').build({
  config: buildConfig,
  publish: 'never',
}).then(() => {
  console.log('\n✅ Build complete. Output in dist-electron/');
}).catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
