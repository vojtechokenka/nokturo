const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const buildDir = path.join(__dirname, '..', 'build');
const iconsDir = path.join(publicDir, 'icons');
const electronIconsDir = path.join(__dirname, '..', 'electron', 'icons');

const darkSvg = path.join(publicDir, 'icon-dark.svg');
const lightSvg = path.join(publicDir, 'icon-light.svg');

const icoSizes = [16, 32, 48, 64, 128, 256];

async function generateIcons() {
  if (!fs.existsSync(darkSvg) || !fs.existsSync(lightSvg)) {
    throw new Error('Both public/icon-dark.svg and public/icon-light.svg are required.');
  }

  const darkBuf = fs.readFileSync(darkSvg);
  const lightBuf = fs.readFileSync(lightSvg);

  for (const dir of [buildDir, iconsDir, electronIconsDir]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // Main app icon (dark variant — used by electron-builder for exe/installer)
  await sharp(darkBuf).resize(1024, 1024).png({ compressionLevel: 0 }).toFile(path.join(publicDir, 'icon.png'));
  console.log('Generated: public/icon.png (1024x1024, dark)');

  // Windows .ico (dark variant — baked into installer)
  const tmpPngs = [];
  for (const size of icoSizes) {
    const tmp = path.join(buildDir, `icon-${size}x${size}.png`);
    await sharp(darkBuf).resize(size, size).png({ compressionLevel: 0 }).toFile(tmp);
    tmpPngs.push(tmp);
  }
  const { default: pngToIco } = await import('png-to-ico');
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), await pngToIco(tmpPngs));
  for (const p of tmpPngs) fs.unlinkSync(p);
  console.log(`Generated: build/icon.ico (${icoSizes.join(', ')}px)`);

  const variants = [
    { name: 'dark', buf: darkBuf },
    { name: 'light', buf: lightBuf },
  ];

  for (const { name, buf } of variants) {
    // Favicon 32px
    await sharp(buf).resize(32, 32).png({ compressionLevel: 6 }).toFile(path.join(publicDir, `icon_32_${name}.png`));
    console.log(`Generated: public/icon_32_${name}.png`);

    // PWA icons 192 & 512
    for (const size of [192, 512]) {
      await sharp(buf).resize(size, size).png({ compressionLevel: 6 }).toFile(path.join(iconsDir, `icon-${size}-${name}.png`));
      console.log(`Generated: public/icons/icon-${size}-${name}.png`);
    }

    // Electron taskbar icon 256px
    await sharp(buf).resize(256, 256).png({ compressionLevel: 6 }).toFile(path.join(electronIconsDir, `icon-${name}.png`));
    console.log(`Generated: electron/icons/icon-${name}.png`);
  }

  // Backward-compat aliases (dark = default)
  fs.copyFileSync(path.join(publicDir, 'icon_32_dark.png'), path.join(publicDir, 'icon_32.png'));
  fs.copyFileSync(path.join(iconsDir, 'icon-192-dark.png'), path.join(iconsDir, 'icon-192.png'));
  fs.copyFileSync(path.join(iconsDir, 'icon-512-dark.png'), path.join(iconsDir, 'icon-512.png'));
  console.log('Copied dark variants as default aliases (icon_32.png, icon-192.png, icon-512.png)');
}

generateIcons().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
