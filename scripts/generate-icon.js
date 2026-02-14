const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '..', 'public', 'icon.svg');
const pngPath = path.join(__dirname, '..', 'public', 'icon.png');
const buildDir = path.join(__dirname, '..', 'build');
const icoPath = path.join(buildDir, 'icon.ico');

// Velikosti pro Windows .ico – každá vykreslena nativně z vektoru (bez škálování = ostré hrany)
const icoSizes = [16, 32, 48, 64, 128, 256];

const svg = fs.readFileSync(svgPath);

async function generateIcons() {
  // 1. Hlavní PNG 1024x1024 (pro macOS, web, atd.)
  await sharp(svg)
    .resize(1024, 1024)
    .png({ compressionLevel: 0 })
    .toFile(pngPath);
  console.log('Icon generated: public/icon.png (1024x1024)');

  // 2. Generovat jednotlivé velikosti pro .ico – každá přímo z SVG (ostré!)
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  const pngPaths = [];
  for (const size of icoSizes) {
    const tempPath = path.join(buildDir, `icon-${size}x${size}.png`);
    await sharp(svg)
      .resize(size, size)
      .png({ compressionLevel: 0 })
      .toFile(tempPath);
    pngPaths.push(tempPath);
  }

  // 3. Vytvořit .ico s předvykreslenými velikostmi
  const { default: pngToIco } = await import('png-to-ico');
  const icoBuffer = await pngToIco(pngPaths);
  fs.writeFileSync(icoPath, icoBuffer);

  // Smazat dočasné PNG soubory
  for (const p of pngPaths) fs.unlinkSync(p);
  console.log(`Icon generated: build/icon.ico (${icoSizes.join(', ')}px)`);
}

generateIcons().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
