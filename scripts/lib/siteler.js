// scripts/lib/siteler.js
// sites.config.json okuma/yazma icin tek merkez. CLI (site-ekle.js) ve panel API'si
// ayni dogrulama + yazma mantigini buradan kullanir.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const KOK = path.resolve(__dirname, '../..');
export const CFG_YOL = path.join(KOK, 'sites.config.json');

export function oku() {
  return JSON.parse(fs.readFileSync(CFG_YOL, 'utf8'));
}

export function yaz(cfg) {
  fs.writeFileSync(CFG_YOL, JSON.stringify(cfg, null, 2) + '\n');
}

// https://www.ornek-site.com/  ->  ornek-site
export function idUret(url, mevcutIdler = []) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  let taban = host.split('.')[0].replace(/[^a-z0-9]+/gi, '').toLowerCase() || 'site';
  let id = taban, n = 2;
  while (mevcutIdler.includes(id)) id = taban + (n++);
  return id;
}

// https://www.ornek-site.com  ->  Ornek Site
export function adUret(url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return host.split('.')[0].replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// girilen adresi normalize eder: "ornek.com" -> "https://ornek.com"
export function urlDuzelt(girdi) {
  let s = String(girdi || '').trim();
  if (!s) throw new Error('URL bos olamaz.');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { throw new Error('Gecersiz URL: ' + girdi); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Sadece http/https adresleri eklenebilir.');
  if (!u.hostname.includes('.')) throw new Error('Gecersiz alan adi: ' + u.hostname);
  return u.origin; // yol/sorgu kismini at
}

function dilleriDuzelt(diller) {
  const list = (Array.isArray(diller) ? diller : String(diller || '').split(','))
    .map(d => String(d).trim().toLowerCase())
    .filter(Boolean);
  return list.length ? [...new Set(list)] : ['tr'];
}

/** Yeni site ekler, eklenen blogu dondurur. Hata durumunda Error firlatir. */
export function ekle({ url, ad, diller, not, aktif = true, id } = {}) {
  const cfg = oku();
  cfg.siteler ||= [];
  const tamUrl = urlDuzelt(url);

  const ayniHost = (a, b) => new URL(a).hostname.replace(/^www\./, '') === new URL(b).hostname.replace(/^www\./, '');
  const cakisan = cfg.siteler.find(s => s.url && ayniHost(s.url, tamUrl));
  if (cakisan) throw new Error(`Bu adres zaten kayitli: ${cakisan.ad} (${cakisan.id})`);

  const idler = cfg.siteler.map(s => s.id);
  const yeniId = (id && String(id).trim()) ? String(id).trim() : idUret(tamUrl, idler);
  if (idler.includes(yeniId)) throw new Error(`Bu id zaten kullaniliyor: ${yeniId}`);

  const blok = {
    id: yeniId,
    ad: (ad && String(ad).trim()) || adUret(tamUrl),
    url: tamUrl,
    aktif: aktif !== false,
    diller: dilleriDuzelt(diller),
    not: String(not || '').trim(),
  };
  cfg.siteler.push(blok);
  yaz(cfg);
  return blok;
}

/** Var olan siteyi gunceller (ad/url/aktif/diller/not). */
export function guncelle(id, alanlar = {}) {
  const cfg = oku();
  const s = (cfg.siteler || []).find(x => x.id === id);
  if (!s) throw new Error('Site bulunamadi: ' + id);
  if (alanlar.url !== undefined) s.url = urlDuzelt(alanlar.url);
  if (alanlar.ad !== undefined) s.ad = String(alanlar.ad).trim() || s.ad;
  if (alanlar.aktif !== undefined) s.aktif = !!alanlar.aktif;
  if (alanlar.diller !== undefined) s.diller = dilleriDuzelt(alanlar.diller);
  if (alanlar.not !== undefined) s.not = String(alanlar.not).trim();
  yaz(cfg);
  return s;
}

/** Siteyi tamamen siler; silinen blogu dondurur. */
export function sil(id) {
  const cfg = oku();
  const i = (cfg.siteler || []).findIndex(x => x.id === id);
  if (i === -1) throw new Error('Site bulunamadi: ' + id);
  const [silinen] = cfg.siteler.splice(i, 1);
  yaz(cfg);
  return silinen;
}

export function liste() {
  return oku().siteler || [];
}
