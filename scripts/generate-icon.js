// Generate app icon + splash icon from inline SVG.
// One-off; run with `node scripts/generate-icon.js`.
const sharp = require('sharp');
const path = require('path');

const ACCENT = '#D7FF42';
const BG = '#08080A';

// Square 1024×1024 — iOS masks corners with its own rounded-rect.
const iconSvg = `
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="${BG}"/>

  <!-- Left plates: thin outer + tall inner -->
  <rect x="170" y="412" width="40" height="200" fill="${ACCENT}" rx="8"/>
  <rect x="226" y="362" width="80" height="300" fill="${ACCENT}" rx="16"/>

  <!-- Bar -->
  <rect x="306" y="486" width="412" height="52" fill="${ACCENT}" rx="6"/>

  <!-- Right plates: tall inner + thin outer -->
  <rect x="718" y="362" width="80" height="300" fill="${ACCENT}" rx="16"/>
  <rect x="814" y="412" width="40" height="200" fill="${ACCENT}" rx="8"/>
</svg>
`;

// Splash uses a transparent background — Expo composes it on top of its own bg
// (configured in app.json under expo-splash-screen → backgroundColor).
const splashSvg = `
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="transparent"/>

  <rect x="170" y="412" width="40" height="200" fill="${ACCENT}" rx="8"/>
  <rect x="226" y="362" width="80" height="300" fill="${ACCENT}" rx="16"/>
  <rect x="306" y="486" width="412" height="52" fill="${ACCENT}" rx="6"/>
  <rect x="718" y="362" width="80" height="300" fill="${ACCENT}" rx="16"/>
  <rect x="814" y="412" width="40" height="200" fill="${ACCENT}" rx="8"/>
</svg>
`;

// Android adaptive icon foreground (transparent background, smaller safe area).
const androidFgSvg = `
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="transparent"/>

  <!-- Scaled to fit Android's 66% inner safe area: occupy ~640×640 in the center -->
  <g transform="translate(192, 192) scale(0.625)">
    <rect x="170" y="412" width="40" height="200" fill="${ACCENT}" rx="8"/>
    <rect x="226" y="362" width="80" height="300" fill="${ACCENT}" rx="16"/>
    <rect x="306" y="486" width="412" height="52" fill="${ACCENT}" rx="6"/>
    <rect x="718" y="362" width="80" height="300" fill="${ACCENT}" rx="16"/>
    <rect x="814" y="412" width="40" height="200" fill="${ACCENT}" rx="8"/>
  </g>
</svg>
`;

async function render(svg, output) {
  await sharp(Buffer.from(svg))
    .resize(1024, 1024)
    .png()
    .toFile(output);
  console.log('Wrote', output);
}

(async () => {
  const out = path.resolve(__dirname, '..', 'assets', 'images');
  await render(iconSvg, path.join(out, 'icon.png'));
  await render(splashSvg, path.join(out, 'splash-icon.png'));
  await render(splashSvg, path.join(out, 'favicon.png'));
  await render(androidFgSvg, path.join(out, 'android-icon-foreground.png'));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
