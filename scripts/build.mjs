/**
 * CYBERCLIP // Build script (scripts/build.mjs)
 * Empaqueta la extensión para la Chrome Web Store generando dist/ y el ZIP limpio
 * (excluyendo tests, scripts, demo.html, tools, .git y node_modules).
 */

import { cpSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');
const zipOut = resolve(root, 'cyberclip-v1.3.0-store.zip');

console.log('[BUILD] Preparando paquete para Chrome Web Store...');

// 1. Limpiar dist
if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// 2. Archivos necesarios para producción
const files = [
  'manifest.json',
  'background.js',
  'content.js',
  'content.css',
  'popup.html',
  'popup.js',
  'popup.css',
  'offscreen.html',
  'offscreen.js'
];

const dirs = [
  'lib',
  'fonts',
  'icons',
  '_locales'
];

for (const f of files) {
  cpSync(resolve(root, f), resolve(dist, f));
}

for (const d of dirs) {
  cpSync(resolve(root, d), resolve(dist, d), { recursive: true });
}

// 3. Validar manifest en dist
const manifest = JSON.parse(readFileSync(resolve(dist, 'manifest.json'), 'utf8'));
if (manifest.version !== '1.3.0') throw new Error(`Versión incorrecta: ${manifest.version}`);
console.log(`[BUILD] Manifest validado: ${manifest.name} v${manifest.version}`);

// 4. Crear ZIP
if (existsSync(zipOut)) rmSync(zipOut, { force: true });
execSync(`cd "${dist}" && zip -r "${zipOut}" . -x "*.DS_Store"`, { stdio: 'inherit' });

console.log(`[BUILD] ✅ ZIP listo: ${zipOut}`);
