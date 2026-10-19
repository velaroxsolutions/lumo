// Renders the app icon, Android adaptive layers, splash and favicon from the
// brand marks (lumo Brand Identity v1.0, §03 and §10) so they're reproducible.
//
//   node scripts/render-brand-assets.js        (needs Playwright + Chromium)
//
// Rules applied: Sunbeam ground with Ink dots for the icon, never the dark
// ground; the compact 5-dot mark below 72px (home-screen icons render ~60px)
// and the 4-dot micro mark with no open ring below 40px (favicon).

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', 'assets');
const BALOO = path.join(__dirname, '..', 'node_modules/@expo-google-fonts/baloo-2/800ExtraBold/Baloo2_800ExtraBold.ttf');
const SUNBEAM = '#FFC53D';
const VIOLET = '#7C6BFF';
const INK = '#221C4A';
const CLOUD = '#F5F3FF';
const MUTED = '#9B94C4';

const FULL = { t: 'translate(5.409,25.191) scale(0.85917)', dots: [[7.45, 14.65, 5.6], [16.91, 30.5, 6.23], [31.94, 41.22, 6.87], [50, 45, 7.5], [68.06, 41.22, 8.13], [83.09, 30.5, 8.77]], ring: [92.55, 14.65, 7.43, 3.95] };
const COMPACT = { t: 'translate(6.914,27.660) scale(0.82699)', dots: [[7.7, 12.13, 7.6], [23.52, 35.14, 8.65], [50, 44, 9.7], [76.48, 35.14, 10.75]], ring: [92.3, 12.13, 9.32, 4.96] };
const MICRO = { t: 'translate(8.007,31.265) scale(0.80370)', dots: [[9.25, 10.16, 10.5], [32.03, 37.96, 12], [67.97, 37.96, 13.5], [90.75, 10.16, 15]], ring: null };

function mark(m, { mono, ringColor, size }) {
  const fill = (i) => mono || (i < Math.ceil(m.dots.length / 2) ? VIOLET : SUNBEAM);
  const dots = m.dots.map(([cx, cy, r], i) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill(i)}"/>`).join('');
  const ring = m.ring ? `<circle cx="${m.ring[0]}" cy="${m.ring[1]}" r="${m.ring[2]}" fill="none" stroke="${ringColor}" stroke-width="${m.ring[3]}"/>` : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100"><g transform="${m.t}">${dots}${ring}</g></svg>`;
}

const page = (w, h, bg, body) => `<!doctype html><html><head><style>
  @font-face { font-family: Baloo; src: url('data:font/ttf;base64,${fs.readFileSync(BALOO).toString('base64')}'); }
  html,body { margin:0; width:${w}px; height:${h}px; background:${bg}; }
  .c { width:${w}px; height:${h}px; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .wm { font-family: Baloo; font-weight: 800; color:${CLOUD}; letter-spacing:-0.005em; line-height:1; }
</style></head><body><div class="c">${body}</div></body></html>`;

const ASSETS = [
  // iOS/App Store master: compact mark, Ink on Sunbeam, square (the OS rounds it).
  { file: 'icon.png', w: 1024, h: 1024, bg: SUNBEAM, body: mark(COMPACT, { mono: INK, ringColor: `${INK}8C`, size: 700 }) },
  // Android adaptive: Ink smile foreground inside the 66% safe zone; Sunbeam background.
  { file: 'android-icon-foreground.png', w: 512, h: 512, bg: 'transparent', body: mark(COMPACT, { mono: INK, ringColor: `${INK}8C`, size: 300 }) },
  { file: 'android-icon-background.png', w: 512, h: 512, bg: SUNBEAM, body: '' },
  { file: 'android-icon-monochrome.png', w: 432, h: 432, bg: 'transparent', body: mark(COMPACT, { mono: '#000000', ringColor: '#0000008C', size: 250 }) },
  // Splash: the grin lockup on Midnight (set in app.json), transparent here.
  { file: 'splash-icon.png', w: 1024, h: 1024, bg: 'transparent', body: `<div class="wm" style="font-size:250px">lumo</div><div style="margin-top:-60px">${mark(FULL, { ringColor: MUTED, size: 420 })}</div>` },
  // Favicon: micro mark (no open ring) on Sunbeam.
  { file: 'favicon.png', w: 48, h: 48, bg: SUNBEAM, body: mark(MICRO, { mono: INK, size: 40 }) },
];

(async () => {
  const browser = await chromium.launch();
  for (const a of ASSETS) {
    const p = await browser.newPage({ viewport: { width: a.w, height: a.h } });
    await p.setContent(page(a.w, a.h, a.bg, a.body));
    await p.evaluate(() => document.fonts.ready);
    if (a.body.includes('class="wm"')) {
      const ok = await p.evaluate(() => document.fonts.check('800 100px Baloo'));
      if (!ok) throw new Error('Baloo 2 did not load — refusing to render a serif wordmark');
    }
    const buf = await p.screenshot({ omitBackground: a.bg === 'transparent' });
    fs.writeFileSync(path.join(OUT, a.file), buf);
    await p.close();
    console.log('wrote', a.file);
  }
  await browser.close();
})();
