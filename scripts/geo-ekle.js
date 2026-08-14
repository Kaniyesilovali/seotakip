// scripts/geo-ekle.js
// GEO / AI gorunurluk sonucunu panele yazar (Claude oturumunda WebSearch ile toplanan sinyal).
// Sadece data.json'daki ilgili sitenin geo + geoDetay alanini doldurur (UI'a dokunmaz).
//
// JSON bicimi:
//   { "siteId":"animare",
//     "geo": {"chatgpt":false,"perplexity":true,"gemini":false},
//     "detay":[{"soru":"...","motor":"perplexity","gorundu":true,"not":"..."}] }
//
// Kullanim:  node scripts/geo-ekle.js <geo.json>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..');
const veriYolu = path.join(KOK, 'data', 'data.json');

const [jsonPath] = process.argv.slice(2);
if (!jsonPath) { console.error('Kullanim: node scripts/geo-ekle.js <geo.json>'); process.exit(1); }
const g = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
if (!g.siteId || !g.geo) { console.error('✕ eksik alan: siteId ve geo gerekli'); process.exit(1); }

const veri = JSON.parse(fs.readFileSync(veriYolu, 'utf8'));
const site = veri.siteler.find(s => s.id === g.siteId);
if (!site) { console.error(`✕ site bulunamadi: ${g.siteId}`); process.exit(1); }

site.geo = {
  chatgpt: !!g.geo.chatgpt, perplexity: !!g.geo.perplexity, gemini: !!g.geo.gemini,
};
if (g.detay) site.geoDetay = g.detay;
site.geoTarih = new Date().toISOString().slice(0, 10);
site._geoGercek = true;

veri.guncelleme = new Date().toISOString();
fs.writeFileSync(veriYolu, JSON.stringify(veri, null, 2));
fs.writeFileSync(path.join(KOK, 'assets', 'fallback-data.js'), 'window.SEO_FALLBACK = ' + JSON.stringify(veri) + ';\n');

const g2 = site.geo;
console.log(`✓ ${site.ad} GEO: ChatGPT ${g2.chatgpt?'✓':'✗'} · Perplexity ${g2.perplexity?'✓':'✗'} · Gemini ${g2.gemini?'✓':'✗'}${g.detay?` (${g.detay.length} sorgu)`:''}`);
