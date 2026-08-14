// scripts/panel.js
// Paneli yerel makinede acar (npm run panel) + "+ Site" butonunun calismasi icin
// kucuk bir yonetim API'si sunar. Sadece 127.0.0.1'e baglanir; disariya acilmaz.
// Yayindaki (FTP'ye yuklenen) dist/ surumu tamamen statiktir, bu sunucu oraya gitmez.
//
// API:
//   GET    /api/siteler        -> sites.config.json icerigi
//   POST   /api/siteler        -> yeni site ekler {url, ad, diller, not}
//   PATCH  /api/siteler/<id>   -> gunceller {aktif, ad, url, diller, not}
//   DELETE /api/siteler/<id>   -> siler

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ekle, guncelle, sil, oku, KOK } from './lib/siteler.js';

const PORT = Number(process.env.PORT || 3000);

const TIPLER = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
};

const jsonYaz = (res, kod, veri) => {
  res.writeHead(kod, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(veri));
};

const govdeOku = (req) => new Promise((resolve, reject) => {
  let s = ''; let boyut = 0;
  req.on('data', c => { boyut += c.length; if (boyut > 1e6) { reject(new Error('Istek govdesi cok buyuk.')); req.destroy(); } s += c; });
  req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error('Gecersiz JSON govdesi.')); } });
  req.on('error', reject);
});

// arka planda tarama (tek seferde bir tane)
let taramaCalisiyor = false;
function taramaBaslat() {
  if (taramaCalisiyor) return { baslatildi: false, mesaj: 'Tarama zaten calisiyor.' };
  taramaCalisiyor = true;
  const p = spawn(process.execPath, [path.join(KOK, 'scripts/crawl.js')], { cwd: KOK, stdio: 'inherit' });
  p.on('exit', (kod) => { taramaCalisiyor = false; console.log(`  tarama bitti (cikis kodu ${kod})`); });
  return { baslatildi: true, mesaj: 'Tarama basladi; bitince paneli yenile.' };
}

async function api(req, res, yol) {
  const parca = yol.split('/').filter(Boolean); // ['api','siteler', id?]
  if (parca[1] !== 'siteler') return jsonYaz(res, 404, { hata: 'Bilinmeyen API yolu.' });
  const id = parca[2] ? decodeURIComponent(parca[2]) : null;

  try {
    if (req.method === 'GET' && !id) {
      const cfg = oku();
      return jsonYaz(res, 200, { siteler: cfg.siteler || [], yazilabilir: true });
    }
    if (req.method === 'POST' && !id) {
      const g = await govdeOku(req);
      const blok = ekle(g);
      console.log(`  + site eklendi: ${blok.ad} (${blok.url})`);
      const tarama = g.tara ? taramaBaslat() : null;
      return jsonYaz(res, 201, { site: blok, tarama });
    }
    if (req.method === 'PATCH' && id) {
      const s = guncelle(id, await govdeOku(req));
      console.log(`  ~ site guncellendi: ${s.ad}`);
      return jsonYaz(res, 200, { site: s });
    }
    if (req.method === 'DELETE' && id) {
      const s = sil(id);
      console.log(`  - site silindi: ${s.ad}`);
      return jsonYaz(res, 200, { site: s });
    }
    return jsonYaz(res, 405, { hata: 'Desteklenmeyen metod.' });
  } catch (e) {
    return jsonYaz(res, 400, { hata: e.message });
  }
}

function statik(req, res, yol) {
  const guvenli = path.normalize(decodeURIComponent(yol)).replace(/^(\.\.[/\\])+/, '');
  let dosya = path.join(KOK, guvenli);
  if (!dosya.startsWith(KOK)) { res.writeHead(403); return res.end('403'); }
  if (fs.existsSync(dosya) && fs.statSync(dosya).isDirectory()) dosya = path.join(dosya, 'index.html');
  // sir dosyalarini asla servis etme
  if (/(^|[/\\])(\.env|gsc-key\.json|node_modules|\.git)([/\\]|$)/.test(path.relative(KOK, dosya))) {
    res.writeHead(403); return res.end('403');
  }
  if (!fs.existsSync(dosya)) { res.writeHead(404); return res.end('Bulunamadi: ' + guvenli); }
  res.writeHead(200, {
    'Content-Type': TIPLER[path.extname(dosya)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(dosya).pipe(res);
}

http.createServer((req, res) => {
  const yol = new URL(req.url, 'http://localhost').pathname;
  if (yol.startsWith('/api/')) return api(req, res, yol);
  statik(req, res, yol === '/' ? '/index.html' : yol);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`\n  SEO panel  →  http://localhost:${PORT}`);
  console.log('  Site ekleme/silme paneldeki "+ Site" butonundan yapilabilir (sites.config.json otomatik guncellenir).\n');
});
