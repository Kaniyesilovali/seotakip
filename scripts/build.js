// scripts/build.js
// FileZilla/FTP ile manuel deploy icin temiz bir "dist/" klasoru uretir.
// SADECE panelin calismasi icin gereken statik dosyalari kopyalar.
// Sir dosyalari (.env, gsc-key.json) ve backend script'leri ASLA kopyalanmaz.
//
// Calistir:  npm run build   ->  sonra dist/ ICINDEKILERI web kokune yukle.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..');
const DIST = path.join(KOK, 'dist');

// yuklenecek dosya listesi (yalnizca bunlar)
const DOSYALAR = [
  'index.html',
  'assets/panel.css',
  'assets/oneri-motoru.js',
  'assets/saglik-motoru.js',
  'assets/app.js',
  'assets/fallback-data.js',
  'data/data.json',
];
// uretilmis raporlar (varsa) — her biri kendi kendine yeten tek HTML dosyasi
const RAPOR_KLASORU = path.join(KOK, 'data', 'raporlar');
const YASAK = ['.env', 'gsc-key.json', 'sites.config.json', 'package.json'];

fs.rmSync(DIST, { recursive: true, force: true });
for (const f of DOSYALAR) {
  const dst = path.join(DIST, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(KOK, f), dst);
}

// raporlar: data.json'daki kayitlar dosyaya isaret ediyor, o dosyalar da yuklenmeli
if (fs.existsSync(RAPOR_KLASORU)) {
  const hedef = path.join(DIST, 'data', 'raporlar');
  fs.mkdirSync(hedef, { recursive: true });
  for (const f of fs.readdirSync(RAPOR_KLASORU).filter(f => f.endsWith('.html')))
    fs.copyFileSync(path.join(RAPOR_KLASORU, f), path.join(hedef, f));
}

// ---- onbellek kirma ----
// index.html + varliklar birlikte degisir; ziyaretcinin tarayicisi eskisini onbellekten
// verirse panel bozuk acilir (yeni HTML + eski JS/CSS). Varlik adresine icerik hash'i ekleyip
// index.html'i onbelleklenmez yaparak bunu engelliyoruz.
const hash = (dosya) => crypto.createHash('md5').update(fs.readFileSync(path.join(DIST, dosya))).digest('hex').slice(0, 8);
const HTML = path.join(DIST, 'index.html');
let html = fs.readFileSync(HTML, 'utf8');
for (const varlik of ['assets/panel.css', 'assets/oneri-motoru.js', 'assets/saglik-motoru.js', 'assets/app.js', 'assets/fallback-data.js']) {
  const oncesi = html;
  html = html.replaceAll(varlik, `${varlik}?v=${hash(varlik)}`);
  if (html === oncesi) console.warn(`! uyari: index.html icinde ${varlik} referansi bulunamadi`);
}
fs.writeFileSync(HTML, html);

// .htaccess: index.html + data.json taze kalsin; surumlenmis varliklar uzun sure onbellekte
fs.writeFileSync(path.join(DIST, '.htaccess'),
`# SEO panel — onbellek politikasi
<IfModule mod_headers.c>
  <FilesMatch "(data\\.json|index\\.html)$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
  </FilesMatch>
  <FilesMatch "\\.(css|js)$">
    Header set Cache-Control "public, max-age=31536000"
  </FilesMatch>
</IfModule>
`);

// guvenlik dogrulamasi
const hepsi = [];
(function tara(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? tara(p) : hepsi.push(path.relative(DIST, p)); } })(DIST);
const sizinti = hepsi.filter(f => YASAK.some(y => f.endsWith(y)));
if (sizinti.length) { console.error('✕ GUVENLIK: dist icinde sir dosyasi var:', sizinti); process.exit(1); }

console.log('✓ dist/ hazir:');
hepsi.forEach(f => console.log('   ', f));
console.log('\n→ FileZilla ile dist/ ICINDEKILERI web kokune (public_html) yukle. Panel degistiginde index.html + assets/ birlikte yuklenmeli.');
