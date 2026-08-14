// scripts/build.js
// FileZilla/FTP ile manuel deploy icin temiz bir "dist/" klasoru uretir.
// SADECE panelin calismasi icin gereken statik dosyalari kopyalar.
// Sir dosyalari (.env, gsc-key.json) ve backend script'leri ASLA kopyalanmaz.
//
// Calistir:  npm run build   ->  sonra dist/ ICINDEKILERI web kokune yukle.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..');
const DIST = path.join(KOK, 'dist');

// yuklenecek dosya listesi (yalnizca bunlar)
const DOSYALAR = [
  'index.html',
  'assets/app.js',
  'assets/fallback-data.js',
  'data/data.json',
];

// asla yuklenmemesi gereken (guvenlik dogrulamasi icin)
const YASAK = ['.env', 'gsc-key.json', 'sites.config.json', 'package.json'];

// temizle + olustur
fs.rmSync(DIST, { recursive: true, force: true });
for (const f of DOSYALAR) {
  const dst = path.join(DIST, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(KOK, f), dst);
}

// .htaccess: data.json'u onbellege alma (yeni veri yukleyince hemen gorunsun) — Apache host'larda
fs.writeFileSync(path.join(DIST, '.htaccess'),
`# SEO panel — data.json her zaman taze
<IfModule mod_headers.c>
  <FilesMatch "data\\.json$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
  </FilesMatch>
</IfModule>
`);

// guvenlik dogrulamasi: dist icinde sir dosyasi olmadigindan emin ol
const hepsi = [];
(function tara(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? tara(p) : hepsi.push(path.relative(DIST, p)); } })(DIST);
const sizinti = hepsi.filter(f => YASAK.some(y => f.endsWith(y)));
if (sizinti.length) { console.error('✕ GUVENLIK: dist icinde sir dosyasi var:', sizinti); process.exit(1); }

console.log('✓ dist/ hazir. Icindeki dosyalar:');
hepsi.forEach(f => console.log('   ', f));
console.log('\n→ FileZilla ile dist/ ICINDEKILERI (index.html, assets/, data/) web kokune (public_html) yukle.');
console.log('  Sir dosyalari (.env, gsc-key.json) dist\'te YOK — guvenli.');
