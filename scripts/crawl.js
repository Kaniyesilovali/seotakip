// scripts/crawl.js
// 5 (aktif) siteyi canli tarar, SEO/on-page/ic-link/kirik-link/SSL/sitemap verisini uretir.
// Cikti: data/data.json (+ data/history/<tarih>.json arsiv). Tamamen ucretsiz, sadece HTTP + TLS.
//
// Calistir:  node scripts/crawl.js
// Not: GSC/PageSpeed gerektiren alanlar (siralama, hiz, indeks, geo, aiBotlar) onceki
//      data.json'dan korunur; onlar Asama 3-5'te dolacak.

import * as cheerio from 'cheerio';
import tls from 'node:tls';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(KOK, 'sites.config.json'), 'utf8'));
const A = cfg.ayarlar || {};
const MAX_SAYFA = A.maxSayfa ?? 200;
const ARALIK = A.istekAralikMs ?? 400;
const ZAMANASIMI = A.zamanAsimiMs ?? 15000;
const UA = A.kullaniciAjani ?? 'SeoTakipBot/1.0';
const MAX_LINK_KONTROL = 400; // site basina kirik-link kontrol ust siniri

const bekle = (ms) => new Promise(r => setTimeout(r, ms));
const bugun = () => new Date().toISOString();

// ---- tek istek (zaman asimli) ----
async function istek(url, method = 'GET') {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ZAMANASIMI);
  const t0 = Date.now();
  try {
    const r = await fetch(url, { method, redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA } });
    const sure = Date.now() - t0;
    let html = '';
    if (method === 'GET' && (r.headers.get('content-type') || '').includes('text/html')) html = await r.text();
    return { ok: true, status: r.status, url: r.url, html, sure, contentType: r.headers.get('content-type') || '' };
  } catch (e) {
    return { ok: false, status: 0, hata: e.name === 'AbortError' ? 'timeout' : e.message, sure: Date.now() - t0 };
  } finally { clearTimeout(t); }
}

// ---- SSL bitis tarihi ----
function sslKontrol(host) {
  return new Promise((resolve) => {
    try {
      const soket = tls.connect({ host, port: 443, servername: host, timeout: 8000 }, () => {
        const cert = soket.getPeerCertificate();
        soket.end();
        if (!cert || !cert.valid_to) return resolve({ gecerli: false, bitis: null, kalanGun: 0 });
        const bitis = new Date(cert.valid_to);
        const kalanGun = Math.round((bitis - Date.now()) / 86400000);
        resolve({ gecerli: kalanGun > 0, bitis: bitis.toISOString().slice(0, 10), kalanGun });
      });
      soket.on('error', () => resolve({ gecerli: false, bitis: null, kalanGun: 0 }));
      soket.on('timeout', () => { soket.destroy(); resolve({ gecerli: false, bitis: null, kalanGun: 0 }); });
    } catch { resolve({ gecerli: false, bitis: null, kalanGun: 0 }); }
  });
}

// ---- URL yardimcilari ----
const normalize = (u) => { try { const x = new URL(u); x.hash = ''; return x.toString().replace(/\/$/, '') || x.origin; } catch { return null; } }
const ayniHost = (u, host) => { try { return new URL(u).host.replace(/^www\./,'') === host.replace(/^www\./,''); } catch { return false; } }

// ---- sitemap URL'leri (XML govdesini icerik tipinden bagimsiz okur, sitemap index'i destekler) ----
async function xmlGetir(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ZAMANASIMI);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA } });
    if (!r.ok || r.status >= 400) return null;
    return await r.text();
  } catch { return null; } finally { clearTimeout(t); }
}
const locCek = (xml) => [...(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g))].map(m => m[1].trim());

async function sitemapUrller(kokUrl) {
  const xml = await xmlGetir(new URL('/sitemap.xml', kokUrl).toString());
  if (xml == null) return { varMi: false, urller: [] };
  let urller = locCek(xml);
  // sitemap index ise (loc'lar .xml gosteriyorsa) alt sitemap'leri de cek (tek seviye)
  if (/<sitemapindex/i.test(xml) && urller.length) {
    const alt = [];
    for (const sm of urller.slice(0, 15)) {
      const x = await xmlGetir(sm);
      if (x) alt.push(...locCek(x));
      await bekle(150);
    }
    urller = alt;
  }
  return { varMi: true, urller: [...new Set(urller)] };
}

// ---- tek sayfayi ayristir ----
function sayfaAyristir(html, sayfaUrl, host) {
  const $ = cheerio.load(html);
  const title = ($('title').first().text() || '').trim();
  const desc = ($('meta[name="description"]').attr('content') || '').trim();
  const h1 = $('h1').length;
  const canonical = $('link[rel="canonical"]').attr('href') || null;
  const robotsMeta = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
  const noindex = robotsMeta.includes('noindex');
  const og = $('meta[property^="og:"]').length;
  const hreflang = $('link[rel="alternate"][hreflang]').length;

  let imgYok = 0;
  $('img').each((_, el) => { const alt = $(el).attr('alt'); if (alt == null || alt.trim() === '') imgYok++; });

  // JSON-LD schema
  const jsonld = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const d = JSON.parse($(el).contents().text());
      const arr = Array.isArray(d) ? d : (d['@graph'] || [d]);
      arr.forEach(o => { if (o && o['@type']) jsonld.push(Array.isArray(o['@type']) ? o['@type'][0] : o['@type']); });
    } catch { jsonld.push('__gecersiz__'); }
  });

  // tracking
  const tracking = [];
  if (/gtag\(|googletagmanager\.com\/gtag|G-[A-Z0-9]{6,}/.test(html)) tracking.push('GA4');
  if (/googletagmanager\.com\/gtm|GTM-[A-Z0-9]+/.test(html)) tracking.push('GTM');

  // linkler
  const icLink = new Set(), disLink = new Set();
  $('a[href]').each((_, el) => {
    let href = $(el).attr('href'); if (!href) return;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
    if (href.includes('/cdn-cgi/')) return; // Cloudflare ic endpoint'leri (email-protection vb.) gercek link degil
    let mutlak; try { mutlak = new URL(href, sayfaUrl).toString(); } catch { return; }
    const n = normalize(mutlak); if (!n) return;
    if (ayniHost(n, host)) icLink.add(n); else disLink.add(n);
  });

  return { title, desc, h1, canonical, noindex, og, hreflang, imgYok, jsonld,
    tracking: [...new Set(tracking)], icLink: [...icLink], disLink: [...disLink] };
}

// ---- basit eszamanli link kontrol havuzu ----
async function linkleriKontrol(linkler, esZaman = 5) {
  const sonuc = new Map();
  let i = 0;
  async function isci() {
    while (i < linkler.length) {
      const u = linkler[i++];
      let r = await istek(u, 'HEAD');
      if (!r.ok || r.status === 405 || r.status === 501) r = await istek(u, 'GET'); // HEAD desteklemeyen sunucular
      sonuc.set(u, r.ok ? r.status : (r.hata === 'timeout' ? 408 : 0));
      await bekle(120);
    }
  }
  await Promise.all(Array.from({ length: Math.min(esZaman, linkler.length) }, isci));
  return sonuc;
}

// ---- tek siteyi tara ----
async function siteTara(site) {
  const kok = site.url.replace(/\/$/, '');
  const host = new URL(kok).host;
  process.stdout.write(`\n▶ ${site.ad} (${host}) taraniyor…\n`);

  // 1) uptime + SSL
  const anasayfa = await istek(kok, 'GET');
  const ssl = await sslKontrol(host.replace(/^www\./, ''));
  const uptime = { durum: anasayfa.ok && anasayfa.status < 400 ? 'up' : 'down', yanitMs: anasayfa.sure || null, sonKontrol: bugun() };

  // 2) robots + sitemap
  const robotsR = await istek(new URL('/robots.txt', kok).toString());
  const robots = { varMi: robotsR.ok && robotsR.status < 400, sorun: false };
  const sm = await sitemapUrller(kok);

  // 3) taranacak URL kuyrugu (sitemap oncelikli, yoksa anasayfadan BFS)
  let kuyruk = [];
  if (sm.varMi && sm.urller.length) kuyruk = sm.urller.map(normalize).filter(Boolean);
  if (!kuyruk.length && anasayfa.html) {
    const ilk = sayfaAyristir(anasayfa.html, kok, host);
    kuyruk = [normalize(kok), ...ilk.icLink];
  }
  kuyruk = [...new Set(kuyruk)].slice(0, MAX_SAYFA);
  if (!kuyruk.length) kuyruk = [normalize(kok)];

  // 4) sayfalari tara
  const sayfalar = new Map();   // url -> ayristirma
  const linkGrafi = new Map();  // hedef -> kac sayfadan link aldi
  const tumDisLink = new Set();
  const gorulen = new Set();
  let ekQueue = [...kuyruk];

  for (let idx = 0; idx < ekQueue.length && sayfalar.size < MAX_SAYFA; idx++) {
    const u = ekQueue[idx];
    if (!u || gorulen.has(u)) continue;
    gorulen.add(u);
    const r = (idx === 0 && anasayfa.html && normalize(anasayfa.url) === u) ? anasayfa : await istek(u, 'GET');
    if (idx !== 0) await bekle(ARALIK);
    if (!r.ok || r.status >= 400 || !r.html) continue;
    const p = sayfaAyristir(r.html, u, host);
    sayfalar.set(u, p);
    p.icLink.forEach(l => { linkGrafi.set(l, (linkGrafi.get(l) || 0) + 1); });
    p.disLink.forEach(l => tumDisLink.add(l));
    // sitemap yoksa yeni ic linkleri kuyruga ekle
    if (!sm.varMi) p.icLink.forEach(l => { if (!gorulen.has(l) && ekQueue.length < MAX_SAYFA) ekQueue.push(l); });
    process.stdout.write(`  · ${sayfalar.size} sayfa\r`);
  }

  // 5) kirik link kontrol (ic + dis, sinirli)
  const kontrolListe = [...new Set([...linkGrafi.keys(), ...tumDisLink])].slice(0, MAX_LINK_KONTROL);
  const durumlar = await linkleriKontrol(kontrolListe);
  // gercek kirik: 404/410, baglanti hatasi (0) veya 5xx sunucu hatasi.
  // 401/403/405/408/429/999 = bot-engelleme / rate-limit / erisim -> gercek kirik DEGIL (dis sosyal linkler bunu doner).
  const kirikSayilir = (kod) => kod === 404 || kod === 410 || kod === 0 || (kod >= 500 && kod < 600);
  // kaynak sayfa esle
  const kirikLinkler = [];
  for (const [sayfaUrl, p] of sayfalar) {
    for (const l of [...p.icLink, ...p.disLink]) {
      const kod = durumlar.get(l);
      if (kod != null && kirikSayilir(kod)) {
        kirikLinkler.push({ kaynak: new URL(sayfaUrl).pathname || '/', hedef: l.length > 60 ? l.slice(0, 60) + '…' : l, kod: kod || 0 });
        if (kirikLinkler.length >= 50) break;
      }
    }
    if (kirikLinkler.length >= 50) break;
  }

  // 6) agregasyon
  const list = [...sayfalar.values()];
  const toplam = list.length;
  const noindex = list.filter(p => p.noindex).length;
  const eksikMeta = {
    title: list.filter(p => !p.title).length,
    description: list.filter(p => !p.desc).length,
    h1: list.filter(p => p.h1 === 0).length,
  };
  const schemaTipler = [...new Set(list.flatMap(p => p.jsonld).filter(t => t && t !== '__gecersiz__'))];
  const schemaVar = list.some(p => p.jsonld.length > 0);
  const schemaGecerli = schemaVar && !list.some(p => p.jsonld.includes('__gecersiz__')) && schemaTipler.length > 0;
  const canonicalEksik = list.filter(p => !p.canonical).length;
  const hreflangVar = list.some(p => p.hreflang > 0);
  const altEksik = list.reduce((a, p) => a + p.imgYok, 0);
  const ogEksik = list.filter(p => p.og === 0).length;
  const tracking = [...new Set(list.flatMap(p => p.tracking))];
  const ortLink = toplam ? +(list.reduce((a, p) => a + p.icLink.length, 0) / toplam).toFixed(1) : 0;
  // orphan: taranan ama hicbir sayfadan ic link almayan (anasayfa haric)
  const orphan = [...sayfalar.keys()].filter(u => u !== normalize(kok) && !linkGrafi.has(u)).map(u => new URL(u).pathname).slice(0, 10);

  // sitemap erisilemez: sitemap URL'lerinden kacinin taramada 4xx/erisilemez oldugu (ornek: kontrol edilenler)
  let sitemapErisilemez = 0;
  if (sm.varMi) sm.urller.slice(0, 50).forEach(u => { const k = durumlar.get(normalize(u)); if (k != null && kirikSayilir(k)) sitemapErisilemez++; });

  // SEO puani (0-100 basit heuristik)
  let puan = 100;
  puan -= Math.min(20, kirikLinkler.length * 3);
  puan -= Math.min(12, eksikMeta.description * 1);
  puan -= Math.min(8, eksikMeta.title * 2);
  puan -= Math.min(8, eksikMeta.h1 * 1);
  puan -= schemaGecerli ? 0 : 8;
  puan -= sm.varMi ? 0 : 8;
  puan -= robots.varMi ? 0 : 4;
  puan -= canonicalEksik > 0 ? Math.min(6, canonicalEksik) : 0;
  puan -= ortLink < 5 ? 5 : 0;
  puan -= orphan.length ? Math.min(6, orphan.length) : 0;
  puan -= altEksik > 10 ? 4 : 0;
  puan -= tracking.length ? 0 : 4;
  puan -= (uptime.yanitMs || 0) > 1500 ? 4 : 0;
  puan = Math.max(0, Math.min(100, Math.round(puan)));

  return {
    seo: { puan },
    uptime, ssl,
    sayfalar: { taranan: toplam, indekslenebilir: toplam - noindex, noindex },
    sayfaYollari: [...sayfalar.keys()].map(u => { try { return new URL(u).pathname; } catch { return u; } }).slice(0, 150),
    kirikLinkler,
    eksikMeta,
    schema: { varMi: schemaVar, gecerli: schemaGecerli, tipler: schemaTipler },
    sitemap: { varMi: sm.varMi, urlSayisi: sm.urller.length, erisilemez: sitemapErisilemez },
    robots,
    canonical: { eksik: canonicalEksik, hatali: 0 },
    hreflang: { sorun: (site.diller?.length > 1) ? !hreflangVar : false },
    onpage: { altEksik, ogEksik, tracking, keywordYogunluk: 'olculmedi' },
    iclink: { ortLink, orphan },
  };
}

// ---- ana ----
async function main() {
  const veriYolu = path.join(KOK, 'data', 'data.json');
  let onceki = {};
  try { onceki = JSON.parse(fs.readFileSync(veriYolu, 'utf8')); } catch {}
  const oncekiSiteler = Object.fromEntries((onceki.siteler || []).map(s => [s.id, s]));

  const aktif = (cfg.siteler || []).filter(s => s.aktif !== false && s.url);
  const siteler = [];

  for (const site of aktif) {
    let tarama;
    try { tarama = await siteTara(site); }
    catch (e) { console.error(`\n  ✕ ${site.ad} hata: ${e.message}`); continue; }
    const eski = oncekiSiteler[site.id] || {};

    siteler.push({
      id: site.id, ad: site.ad, url: site.url, aktif: true,
      ...tarama,
      // trend: onceki puana gore
      seo: { puan: tarama.seo.puan, onceki: eski.seo?.puan ?? tarama.seo.puan,
        trend: eski.seo?.puan != null ? (tarama.seo.puan - eski.seo.puan >= 0 ? '+' : '') + (tarama.seo.puan - eski.seo.puan) : '0' },
      // GSC/PageSpeed/GEO alanlari: henuz olculemiyor -> bos (Asama 3-5'te dolacak).
      // Yalnizca gercek bir kaynaktan gelmisse korunur (eski._<alan>Gercek isaretli degilse tasima).
      hiz: eski._hizGercek ? eski.hiz : null,
      indeks: eski._indeksGercek ? eski.indeks : null,
      aiBotlar: eski._botGercek ? eski.aiBotlar : null,
      geo: eski._geoGercek ? eski.geo : null,
      siralama: eski._siralamaGercek ? eski.siralama : [],
      rakip: eski._rakipGercek ? eski.rakip : [],
      kanibalizasyon: [],
      icerikBoslugu: eski._gapGercek ? eski.icerikBoslugu : [],
      // gercek-veri bayraklarini sonraki taramaya tasi (yoksa GSC/PageSpeed verisi silinir)
      ...(eski._hizGercek ? { _hizGercek: true } : {}),
      ...(eski._siralamaGercek ? { _siralamaGercek: true } : {}),
      ...(eski._gapGercek ? { _gapGercek: true } : {}),
      ...(eski._indeksGercek ? { _indeksGercek: true } : {}),
      ...(eski._botGercek ? { _botGercek: true } : {}),
      ...(eski._geoGercek ? { _geoGercek: true } : {}),
      ...(eski._rakipGercek ? { _rakipGercek: true } : {}),
    });
    process.stdout.write(`  ✓ ${site.ad}: puan ${tarama.seo.puan}, ${tarama.sayfalar.taranan} sayfa, ${tarama.kirikLinkler.length} kirik link\n`);
  }

  // ozet
  const ortalama = siteler.length ? Math.round(siteler.reduce((a, s) => a + s.seo.puan, 0) / siteler.length) : 0;
  const toplamKirik = siteler.reduce((a, s) => a + s.kirikLinkler.length, 0);

  // uyarilar
  const uyarilar = [];
  siteler.forEach(s => {
    if (s.ssl?.gecerli && s.ssl.kalanGun <= 30) uyarilar.push({ seviye: s.ssl.kalanGun <= 14 ? 'kritik' : 'uyari', site: s.id, mesaj: `SSL sertifikasi ${s.ssl.kalanGun} gun sonra doluyor (${s.ssl.bitis})` });
    if (!s.ssl?.gecerli) uyarilar.push({ seviye: 'kritik', site: s.id, mesaj: 'SSL sertifikasi gecersiz/erisilemez' });
    if (s.uptime?.durum === 'down') uyarilar.push({ seviye: 'kritik', site: s.id, mesaj: 'Site erisilemez (down)' });
    if (!s.sitemap?.varMi) uyarilar.push({ seviye: 'uyari', site: s.id, mesaj: 'sitemap.xml bulunamadi' });
    if (s.kirikLinkler.length) uyarilar.push({ seviye: 'uyari', site: s.id, mesaj: `${s.kirikLinkler.length} kirik link tespit edildi` });
    if (s.hreflang?.sorun) uyarilar.push({ seviye: 'uyari', site: s.id, mesaj: 'hreflang etiketleri eksik/tutarsiz' });
  });
  const acilUyari = uyarilar.filter(u => u.seviye === 'kritik').length;

  // degisiklikler (onceki taramaya gore)
  const degisiklikler = [];
  siteler.forEach(s => {
    const e = oncekiSiteler[s.id]; if (!e) return;
    if (e.seo?.puan != null && e.seo.puan !== s.seo.puan)
      degisiklikler.push({ site: s.id, tip: s.seo.puan > e.seo.puan ? 'artis' : 'dusus', mesaj: `SEO puani ${e.seo.puan} → ${s.seo.puan} (${s.seo.trend})`, tarih: bugun().slice(0, 10) });
    const yeniKirik = s.kirikLinkler.length - (e.kirikLinkler?.length || 0);
    if (yeniKirik > 0) degisiklikler.push({ site: s.id, tip: 'yeni-kirik', mesaj: `${yeniKirik} yeni kirik link`, tarih: bugun().slice(0, 10) });
    const sayfaFark = s.sayfalar.taranan - (e.sayfalar?.taranan || 0);
    if (sayfaFark !== 0) degisiklikler.push({ site: s.id, tip: sayfaFark > 0 ? 'yeni-sayfa' : 'silinen-sayfa', mesaj: `${Math.abs(sayfaFark)} sayfa ${sayfaFark > 0 ? 'eklendi' : 'azaldi'}`, tarih: bugun().slice(0, 10) });
  });

  const cikti = {
    guncelleme: bugun(),
    ozet: { toplamSite: siteler.length, ortalamaSeoPuan: ortalama, toplamKirikLink: toplamKirik, acilUyari },
    siteler,
    degisiklikler,
    raporlar: onceki.raporlar || [],
    uretilenIcerikler: onceki.uretilenIcerikler || [],
    uyarilar,
  };

  fs.writeFileSync(veriYolu, JSON.stringify(cikti, null, 2));
  // arsiv
  const arsivDizin = path.join(KOK, 'data', 'history');
  fs.mkdirSync(arsivDizin, { recursive: true });
  fs.writeFileSync(path.join(arsivDizin, bugun().slice(0, 10) + '.json'), JSON.stringify(cikti, null, 2));
  // panel fallback (file:// icin)
  fs.writeFileSync(path.join(KOK, 'assets', 'fallback-data.js'), 'window.SEO_FALLBACK = ' + JSON.stringify(cikti) + ';\n');

  console.log(`\n✅ Bitti. ${siteler.length} site, ortalama puan ${ortalama}, ${toplamKirik} kirik link, ${uyarilar.length} uyari.`);
  console.log(`   → data/data.json guncellendi.`);
}

main().catch(e => { console.error('HATA:', e); process.exit(1); });
