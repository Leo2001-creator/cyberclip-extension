import { chromium } from 'playwright-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const storeDir = resolve(root, 'store');
mkdirSync(storeDir, { recursive: true });

async function run() {
  console.log('[SCREENSHOTS] Generando capturas para Web Store...');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // 1. Screenshot 1: Demo general con banco de datos
  const p1 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await p1.goto('file://' + resolve(root, 'demo.html'), { waitUntil: 'load' });
  await p1.waitForTimeout(800);
  await p1.screenshot({ path: resolve(storeDir, 'screenshot-1-hud.png') });
  console.log('[SCREENSHOTS] Screenshot 1 lista.');

  // 2. Screenshot 2: Pestaña 04. CONFIG en el iframe
  try {
    const frame = p1.frame('previewFrame') || p1.frames()[1];
    if (frame) {
      await frame.click('#tabBtnConfig');
      await p1.waitForTimeout(600);
      await p1.screenshot({ path: resolve(storeDir, 'screenshot-2-config.png') });
      console.log('[SCREENSHOTS] Screenshot 2 (Config) lista.');

      // 3. Screenshot 3: Pestaña 03. TELEMETRÍA
      await frame.click('#tabBtnSystem');
      await p1.waitForTimeout(600);
      await p1.screenshot({ path: resolve(storeDir, 'screenshot-3-telemetry.png') });
      console.log('[SCREENSHOTS] Screenshot 3 (Telemetría) lista.');
    }
  } catch (e) {
    console.warn('[SCREENSHOTS] Warning iframe:', e.message);
  }
  await p1.close();

  // 4. Promo Tile 440x280 (Requisito estricto Web Store)
  const p3 = await browser.newPage({ viewport: { width: 440, height: 280 } });
  const promoHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <link rel="stylesheet" href="file://${resolve(root, 'fonts/fonts.css')}">
      <style>
        body {
          margin: 0;
          width: 440px;
          height: 280px;
          background: #08090C;
          color: #E5E9F0;
          font-family: 'Rajdhani', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          border: 2px solid #00F0FF;
          position: relative;
          overflow: hidden;
          background-image: 
            radial-gradient(circle at 85% 15%, rgba(0, 240, 255, 0.22) 0%, transparent 55%),
            radial-gradient(circle at 15% 85%, rgba(252, 238, 10, 0.15) 0%, transparent 55%);
        }
        .icon {
          width: 60px;
          height: 60px;
          margin-bottom: 6px;
          filter: drop-shadow(0 0 12px #FCEE0A);
        }
        h1 {
          font-family: 'Orbitron', monospace;
          font-size: 26px;
          margin: 0;
          color: #FCEE0A;
          letter-spacing: 2px;
          text-shadow: 0 0 10px rgba(252, 238, 10, 0.5);
        }
        h1 span { color: #00F0FF; }
        p {
          font-family: 'Share Tech Mono', monospace;
          font-size: 11px;
          color: #00F0FF;
          margin: 4px 0 0 0;
          letter-spacing: 1.5px;
        }
        .tags {
          display: flex;
          gap: 6px;
          margin-top: 14px;
        }
        .chip {
          font-family: 'Share Tech Mono', monospace;
          font-size: 9px;
          padding: 3px 8px;
          border: 1px solid #00F0FF;
          color: #00F0FF;
          background: rgba(0, 240, 255, 0.12);
          clip-path: polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px));
        }
        .chip.yellow { border-color: #FCEE0A; color: #FCEE0A; background: rgba(252, 238, 10, 0.12); }
      </style>
    </head>
    <body>
      <svg class="icon" viewBox="0 0 24 24" fill="none">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="#FCEE0A" stroke="#00F0FF" stroke-width="1.5" />
      </svg>
      <h1>CYBERCLIP<span>//HUD</span></h1>
      <p>// HIGH-TECH WEB CLIPPER & NOTES</p>
      <div class="tags">
        <span class="chip yellow">★ FAVORITOS</span>
        <span class="chip">NEON HIGHLIGHT</span>
        <span class="chip yellow">100MB LOCAL</span>
        <span class="chip">PRIVACIDAD 100%</span>
      </div>
    </body>
    </html>
  `;
  await p3.setContent(promoHtml);
  await p3.waitForTimeout(400);
  await p3.screenshot({ path: resolve(storeDir, 'promo-tile-440x280.png') });
  console.log('[SCREENSHOTS] Promo tile lista.');
  await p3.close();

  await browser.close();
  console.log('[SCREENSHOTS] Completado.');
}

run().catch(err => {
  console.error('[SCREENSHOTS ERROR]', err);
  process.exit(1);
});
