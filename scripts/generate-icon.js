const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '..', 'public', 'icon.svg');
const pngPath = path.join(__dirname, '..', 'public', 'icon.png');
const buildDir = path.join(__dirname, '..', 'build');
const icoPath = path.join(buildDir, 'icon.ico');
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Velikosti pro Windows .ico
const icoSizes = [16, 32, 48, 64, 128, 256];

async function generateIcons() {
  let sourceBuffer;
  let usePngFallback = false;

  if (fs.existsSync(svgPath)) {
    sourceBuffer = fs.readFileSync(svgPath);
  } else if (fs.existsSync(pngPath)) {
    sourceBuffer = fs.readFileSync(pngPath);
    usePngFallback = true;
    console.log('Using public/icon.png (icon.svg not found)');
  } else {
    throw new Error('Neither public/icon.svg nor public/icon.png found. Add one of them.');
  }

  // 1. Hlavní PNG 1024x1024 (pro macOS, web, atd.) – jen pokud máme SVG (jinak icon.png už existuje)
  if (!usePngFallback) {
    await sharp(sourceBuffer)
      .resize(1024, 1024)
      .png({ compressionLevel: 0 })
      .toFile(pngPath);
    console.log('Icon generated: public/icon.png (1024x1024)');
  }

  // 2. Generovat .ico pro Windows
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  const pngPaths = [];
  for (const size of icoSizes) {
    const tempPath = path.join(buildDir, `icon-${size}x${size}.png`);
    await sharp(sourceBuffer)
      .resize(size, size)
      .png({ compressionLevel: 0 })
      .toFile(tempPath);
    pngPaths.push(tempPath);
  }

  const { default: pngToIco } = await import('png-to-ico');
  const icoBuffer = await pngToIco(pngPaths);
  fs.writeFileSync(icoPath, icoBuffer);

  for (const p of pngPaths) fs.unlinkSync(p);
  console.log(`Icon generated: build/icon.ico (${icoSizes.join(', ')}px)`);

  // 3. PWA ikony (192, 512) – jen pokud máme SVG (jinak použijeme existující nebo vygenerujeme z PNG)
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
  if (!usePngFallback) {
    const svg = sourceBuffer.toString('utf-8');
    const svgDark = svg
      .replace(/fill="white"/g, 'fill="#0a0a0a"')
      .replace(/fill="black"/g, 'fill="white"')
      .replace(/stroke="black"/g, 'stroke="white"');
    for (const size of [192, 512]) {
      const outPath = path.join(iconsDir, `icon-${size}.png`);
      await sharp(Buffer.from(svgDark))
        .resize(size, size)
        .png({ compressionLevel: 6 })
        .toFile(outPath);
      console.log(`PWA icon generated: public/icons/icon-${size}.png`);
    }
  } else {
    for (const size of [192, 512]) {
      const outPath = path.join(iconsDir, `icon-${size}.png`);
      await sharp(sourceBuffer)
        .resize(size, size)
        .png({ compressionLevel: 6 })
        .toFile(outPath);
      console.log(`PWA icon generated: public/icons/icon-${size}.png`);
    }
  }
}

generateIcons().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
