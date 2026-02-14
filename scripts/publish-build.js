/**
 * Build and publish Nokturo to GitHub Releases.
 * Uses GITHUB_OWNER, GITHUB_REPO, GH_TOKEN from environment or .env file.
 *
 * Setup (jednou):
 *   1. Vytvoř soubor .env v kořeni projektu s obsahem:
 *      GH_TOKEN=ghp_tvůj_token
 *   2. .env je v .gitignore – token se necommitne
 *
 * Pak stačí: npm run electron:build:publish
 */
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });
require('dotenv').config({ path: path.join(root, '.env.local') });

const { execSync } = require('child_process');
const owner = process.env.GITHUB_OWNER || 'vojtechokenka';
const repo = process.env.GITHUB_REPO || 'nokturo';

// 1. Generate icon
console.log('[1/3] Generating icon...');
execSync('node scripts/generate-icon.js', { cwd: root, stdio: 'inherit' });

// 2. Vite build
console.log('[2/3] Building Vite...');
execSync('vite build', { cwd: root, stdio: 'inherit' });

// 3. Electron builder with publish config (programmatic API for reliable env-based config)
console.log('[3/3] Building and publishing to GitHub...');
const ghToken = process.env.GH_TOKEN;
if (!ghToken || !ghToken.startsWith('ghp_')) {
  console.error('\n❌ GH_TOKEN není nastaven. Přidej do .env v kořeni projektu:');
  console.error('   GH_TOKEN=ghp_tvůj_github_token');
  console.error('   Token vytvoříš na: https://github.com/settings/tokens (scope: repo)');
  process.exit(1);
}
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const buildConfig = {
  ...pkg.build,
  publish: {
    provider: 'github',
    owner,
    repo,
    releaseType: 'release', // draft = neviditelné; release = veřejné
  },
};

require('electron-builder').build({
  config: buildConfig,
  publish: 'always',
}).then(() => {
  console.log('\n✅ Build and publish complete. Check GitHub Releases.');
}).catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
