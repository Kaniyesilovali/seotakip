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
import { ayristir as robotsAyristir, izinVar, botOzeti, icerikSinyali, tamamenKapali } from './lib/robots.js';
import { metinParmakIzi, siteSorunlari, durumSinifi } from './lib/sorun-tespit.js';
import { taramaDogrula } from './lib/tarama-dogrula.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// SEOTAKIP_KOK: config'i ve ciktilari baska bir klasorden okuyup oraya yazar.
// Yalnizca test icin var (test/ucbasa.test.js gecici bir kok olusturup fixture siteyi
// tarar) — boylece test gercek data/data.json'i EZMEZ. Normal kullanimda tanimsizdir.
const KOK = process.env.SEOTAKIP_KOK ? path.resolve(process.env.SEOTAKIP_KOK) : path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(KOK, 'sites.config.json'), 'utf8'));
const A = cfg.ayarlar || {};
const MAX_SAYFA = A.maxSayfa ?? 200;
const ARALIK = A.istekAralikMs ?? 400;
const ZAMANASIMI = A.zamanAsimiMs ?? 15000;
const UA = A.kullaniciAjani ?? 'SeoTakipBot/1.0';
const MAX_LINK_KONTROL = 400; // site basina kirik-link kontrol ust siniri
const INCE_ESIK = 200;        // bu kelimenin altindaki sayfa "ince icerik" sayilir (Semrush ile ayni esik)

// Google'in rich result icin bekledigi alanlar. Eksikse zengin sonuc cikmaz,
// schema teknik olarak gecerli olsa bile. (Semrush #45 ile ayni mantik.)
const SEMA_GEREK = {
  Article:       ['headline', 'image', 'datePublished', 'author'],
  BlogPosting:   ['headline', 'image', 'datePublished', 'author'],
  NewsArticle:   ['headline', 'image', 'datePublished', 'author'],
  Product:       ['name', 'image', 'offers'],
  FAQPage:       ['mainEntity'],
  BreadcrumbList:['itemListElement'],
  Organization:  ['name', 'url'],
  LocalBusiness: ['name', 'address', 'telephone'],
  Service:       ['name', 'provider'],
  Event:         ['name', 'startDate', 'location'],
  VideoObject:   ['name', 'description', 'thumbnailUrl', 'uploadDate'],
  Recipe:        ['name', 'image', 'recipeIngredient', 'recipeInstructions'],
  HowTo:         ['name', 'step'],
  JobPosting:    ['title', 'datePosted', 'hiringOrganization', 'jobLocation'],
};
// LocalBusiness alt tipleri: hepsi ayni zorunlu alanlara tabi
const YEREL_ISLETME = new Set(['LocalBusiness', 'VeterinaryCare', 'Dentist', 'Physician', 'MedicalBusiness',
  'Restaurant', 'Store', 'ProfessionalService', 'HealthAndBeautyBusiness', 'LegalService', 'FinancialService',
  'InsuranceAgency', 'AccountingService', 'RealEstateAgent', 'AutomotiveBusiness', 'HomeAndConstructionBusiness',
  'TravelAgency', 'LodgingBusiness', 'SportsActivityLocation', 'ChildCare', 'EducationalOrganization']);

const alanVar = (o, k) => {
  const v = o[k];
  if (v == null || v === '') return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
};

const bekle = (ms) => new Promise(r => setTimeout(r, ms));
const bugun = () => new Date().toISOString();

// ---- tek istek (zaman asimli) ----
// Yonlendirmeleri ELLE izliyoruz (redirect:'manual'): 'follow' kullanildiginda 301/302
// bilgisi kayboluyordu, oysa "hangi sayfa nereye yonleniyor" panelde gosterilecek veri.
const YONLENDIRME_KODU = new Set([301, 302, 303, 307, 308]);
async function istek(url, method = 'GET', { maxAdim = 5 } = {}) {
  const t0 = Date.now();
  let hedef = url;
  const zincir = [];   // [{ url, kod, hedef }]
  // Ziyaret edilen adresler: ayni adrese ikinci kez donuluyorsa bu bir DONGU'dur
  // (www/egik cizgi/dil on eki kurallari birbirini geri cevirdiginde olusur).
  // Eskiden maxAdim'e dayanip son yaniti donuyorduk; donguyle uzun zincir ayirt edilmiyordu.
  const gorulenAdres = new Set([normalizeAdim(url)]);
  for (let adim = 0; ; adim++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ZAMANASIMI);
    try {
      const r = await fetch(hedef, { method, redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': UA } });
      const konum = r.headers.get('location');
      if (YONLENDIRME_KODU.has(r.status) && konum && adim < maxAdim) {
        let sonraki = null;
        try { sonraki = new URL(konum, hedef).toString(); } catch {}
        if (sonraki && sonraki !== hedef) {
          zincir.push({ url: hedef, kod: r.status, hedef: sonraki });
          if (gorulenAdres.has(normalizeAdim(sonraki))) {
            return { ok: false, status: r.status, url: sonraki, dongu: true,
              hata: 'yonlendirme dongusu', sure: Date.now() - t0, zincir };
          }
          gorulenAdres.add(normalizeAdim(sonraki));
          hedef = sonraki;
          continue;   // sonraki halkaya git
        }
      }
      let html = '';
      if (method === 'GET' && (r.headers.get('content-type') || '').includes('text/html')) html = await r.text();
      return { ok: true, status: r.status, url: hedef, html, sure: Date.now() - t0,
        contentType: r.headers.get('content-type') || '',
        // X-Robots-Tag: noindex meta etiketi olmadan da sayfayi indeksten cikarir.
        // Sadece <meta name="robots"> okumak eksik denetimdi.
        xRobots: (r.headers.get('x-robots-tag') || '').toLowerCase(),
        zincir };
    } catch (e) {
      return { ok: false, status: 0, hata: e.name === 'AbortError' ? 'timeout' : e.message, sure: Date.now() - t0, zincir };
    } finally { clearTimeout(t); }
  }
}
// Dongu tespitinde kullanilan normalize: SADECE hash atilir.
// Sondaki egik cizgiyi ATMAYIZ — cogu site /tr -> 308 -> /tr/ yonlendirmesi yapar ve
// egik cizgi silinirse bu mesru yonlendirme "dongu" gorunur (tum site 0 sayfa tarandi
// olarak biter). Gercek dongu zaten AYNI adrese birebir geri doner.
const normalizeAdim = (u) => { try { const x = new URL(u); x.hash = ''; return x.toString(); } catch { return String(u); } };

// duz metin dosyalari (robots.txt): icerik tipinden bagimsiz govdeyi verir.
// Soft-404 yapan sunucular HTML dondurur -> onu "dosya yok" say.
async function metinGetir(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ZAMANASIMI);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA } });
    if (!r.ok || r.status >= 400) return { ok: false, status: r.status, metin: null };
    const metin = await r.text();
    const htmlMi = /text\/html/.test(r.headers.get('content-type') || '') || /^\s*<(!doctype|html)/i.test(metin);
    return { ok: !htmlMi, status: r.status, metin: htmlMi ? null : metin };
  } catch { return { ok: false, status: 0, metin: null }; }
  finally { clearTimeout(t); }
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

// Tek bir sitemap dosyasini (gerekirse index'ini) okur.
async function sitemapOku(url) {
  const xml = await xmlGetir(url);
  if (xml == null) return null;
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
  return urller;
}

// robots.txt'te bildirilen sitemap'ler + varsayilan /sitemap.xml.
// Bildirilenleri okumak onemli: siteler urun/blog haritasini ayri dosyada tutabiliyor
// (ornek: luxeva'nin /urun-sitemap.xml'i) ve o sayfalar yoksa denetim eksik kalir.
async function sitemapUrller(kokUrl, bildirilen = []) {
  const adaylar = [...new Set([...bildirilen, new URL('/sitemap.xml', kokUrl).toString()])];
  const urller = [];
  const bulunan = [];
  for (const aday of adaylar.slice(0, 10)) {
    const liste = await sitemapOku(aday);
    if (liste == null) continue;
    bulunan.push(aday);
    urller.push(...liste);
  }
  return { varMi: bulunan.length > 0, dosyalar: bulunan, urller: [...new Set(urller)] };
}

// ---- tek sayfayi ayristir ----
function sayfaAyristir(html, sayfaUrl, host, { xRobots = '' } = {}) {
  const $ = cheerio.load(html);
  const title = ($('title').first().text() || '').trim();
  const desc = ($('meta[name="description"]').attr('content') || '').trim();
  const h1 = $('h1').length;
  // Tek canonical yerine HEPSINI topluyoruz: birden fazla farkli canonical celiskili
  // sinyaldir ve Google ikisini de yok sayabilir (canonical-cakismasi bulgusu).
  const canonicalListe = [...new Set($('link[rel="canonical"]').map((_, el) =>
    ($(el).attr('href') || '').trim()).get().filter(Boolean).map(h => {
      try { return new URL(h, sayfaUrl).toString(); } catch { return h; }
    }))];
  const canonical = canonicalListe[0] || null;
  const robotsMeta = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
  // noindex iki yerden gelebilir: meta etiketi VEYA X-Robots-Tag basligi.
  const metaNoindex = robotsMeta.includes('noindex');
  const basligNoindex = /(^|[,\s])noindex/.test(xRobots || '');
  const noindex = metaNoindex || basligNoindex;
  const noindexKaynak = metaNoindex ? (basligNoindex ? 'meta + X-Robots-Tag' : 'meta robots') : (basligNoindex ? 'X-Robots-Tag' : null);
  const og = $('meta[property^="og:"]').length;
  const hreflang = $('link[rel="alternate"][hreflang]').length;

  // Baslik seviyeleri, belgedeki SIRAYLA. H2'den H4'e atlama hiyerarsiyi bozar.
  const baslikSeviyeleri = $('h1, h2, h3, h4, h5, h6')
    .map((_, el) => Number(el.tagName.slice(1))).get();

  let imgYok = 0;
  $('img').each((_, el) => { const alt = $(el).attr('alt'); if (alt == null || alt.trim() === '') imgYok++; });

  // JSON-LD schema (tip listesi + Google'in bekledigi eksik alanlar)
  const jsonld = [];
  const semaEksik = [];   // ['BlogPosting.image', ...]
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const d = JSON.parse($(el).contents().text());
      const arr = Array.isArray(d) ? d : (d['@graph'] || [d]);
      arr.forEach(o => {
        if (!o || !o['@type']) return;
        const tip = Array.isArray(o['@type']) ? o['@type'][0] : o['@type'];
        jsonld.push(tip);
        const gerek = SEMA_GEREK[tip] || (YEREL_ISLETME.has(tip) ? SEMA_GEREK.LocalBusiness : null);
        if (gerek) gerek.forEach(k => { if (!alanVar(o, k)) semaEksik.push(`${tip}.${k}`); });
      });
    } catch { jsonld.push('__gecersiz__'); }
  });

  // govde kelime sayisi (menu/footer haric — icerik hacmini olcer)
  const govde = $('main').first().length ? $('main').first()
    : ($('article').first().length ? $('article').first() : $('body'));
  const klon = govde.clone();
  klon.find('script, style, noscript, svg, nav, header, footer, form').remove();
  const metin = klon.text().replace(/\s+/g, ' ').trim();
  const kelime = metin ? metin.split(' ').length : 0;
  // Gorunur govdenin parmak izi — iki URL ayni metni sunuyorsa yinelenen icerik.
  const metinIzi = metinParmakIzi(metin);

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

  return { title, desc, h1, canonical, canonicalListe, noindex, noindexKaynak, baslikSeviyeleri,
    og, hreflang, imgYok, jsonld, semaEksik, kelime, metinIzi,
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
async function siteTara(site, eski = {}) {
  const kok = site.url.replace(/\/$/, '');
  const host = new URL(kok).host;
  process.stdout.write(`\n▶ ${site.ad} (${host}) taraniyor…\n`);

  // 1) uptime + SSL
  const anasayfa = await istek(kok, 'GET');
  const ssl = await sslKontrol(host.replace(/^www\./, ''));
  const uptime = { durum: anasayfa.ok && anasayfa.status < 400 ? 'up' : 'down', yanitMs: anasayfa.sure || null, sonKontrol: bugun() };

  // 2) robots.txt — artik GOVDESI ayristiriliyor. "AI motorlari bu siteyi tarayabiliyor mu"
  //    sorusunun cevabi burada; eskiden sadece dosyanin var olup olmadigina bakiyorduk.
  const robotsR = await metinGetir(new URL('/robots.txt', kok).toString());
  const rob = robotsAyristir(robotsR.ok ? robotsR.metin : null);
  const robotsVar = robotsR.ok && !!robotsR.metin;
  const sm = await sitemapUrller(kok, rob.sitemapler);

  // 2b) llms.txt (AI motorlari icin site ozeti). HTML donen sunucular soft-404 yapiyor -> onu yok say.
  const llmsR = await istek(new URL('/llms.txt', kok).toString());
  const llms = { varMi: llmsR.ok && llmsR.status < 400 && !llmsR.html && !/text\/html/.test(llmsR.contentType || '') };

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
  const sureler = [];           // her basarili sayfanin yanit suresi (medyan icin)
  const sayfaSure = new Map();  // url -> yanit ms (sayfa bazli "yavas yanit" bulgusu icin)
  const linkGrafi = new Map();  // hedef -> kac sayfadan link aldi
  const tumDisLink = new Set();
  const gorulen = new Set();
  const kayit = [];             // her URL icin TEK durum satiri: saglam/sorunlu/kirik/yonlendirme/engelli
  let ekQueue = [...kuyruk];

  // Kendi botumuza robots.txt ile kapatilmis sayfayi TARAMAYIZ; "engelli" diye kaydederiz.
  const BOT_ADI = UA.split('/')[0];
  const yolCek = (u) => { try { return new URL(u).pathname || '/'; } catch { return u; } };

  for (let idx = 0; idx < ekQueue.length && sayfalar.size < MAX_SAYFA; idx++) {
    const u = ekQueue[idx];
    if (!u || gorulen.has(u)) continue;
    gorulen.add(u);
    const yol = yolCek(u);

    const izin = izinVar(rob, BOT_ADI, yol);
    if (!izin.izin) { kayit.push({ yol, durum: 'engelli', kural: izin.kural }); continue; }

    const r = (idx === 0 && anasayfa.html && !anasayfa.zincir?.length && normalize(anasayfa.url) === u)
      ? anasayfa : await istek(u, 'GET');
    if (idx !== 0) await bekle(ARALIK);

    // Yonlendirme: satiri "yonlendirme" olarak kapat, icerik analizi HEDEF sayfada yapilsin.
    // AMA once eleme: normalize() sondaki egik cizgiyi atiyor, oysa cogu site /tr/ ile
    // calisiyor -> istek /tr'ye gidip 308 ile /tr/'ye donuyor. Bu SITENIN yonlendirmesi
    // degil, bizim normalize'imizin yan etkisi. Hedef ayni sayfaya normalize oluyorsa
    // yonlendirme sayma, sayfayi normal analiz et.
    // Dongu: yonlendirme kendine geri donuyor -> sayfa hicbir zaman acilmaz.
    if (r.dongu) {
      kayit.push({ yol, kod: r.status, durum: 'yonlendirme', adim: r.zincir.length, dongu: true,
        hedef: yolCek(r.url) });
      continue;
    }
    const hedefUrl = r.zincir?.length ? normalize(r.url) : null;
    if (hedefUrl && hedefUrl !== u) {
      kayit.push({ yol, kod: r.zincir[0].kod, durum: 'yonlendirme', adim: r.zincir.length,
        hedef: ayniHost(hedefUrl, host) ? yolCek(hedefUrl) : hedefUrl });
      if (ayniHost(hedefUrl, host) && !gorulen.has(hedefUrl) && ekQueue.length < MAX_SAYFA) ekQueue.push(hedefUrl);
      continue;
    }
    if (!r.ok || r.status >= 400) {
      // 403/429 ve bot dogrulama sayfalari "kirik" DEGIL: sayfa saglam olabilir, biz
      // goremedik. Ayri sinif -> "sitende N kirik sayfa var" yanilsamasi olusmasin.
      kayit.push({ yol, kod: r.ok ? r.status : 0, durum: 'kirik', hata: r.hata || null,
        sinif: durumSinifi(r.ok ? r.status : 0, r.html || '') });
      continue;
    }
    if (!r.html) { kayit.push({ yol, kod: r.status, durum: 'saglam', not: 'HTML degil' }); continue; }

    if (r.sure != null) { sureler.push(r.sure); sayfaSure.set(u, r.sure); }
    const p = sayfaAyristir(r.html, u, host, { xRobots: r.xRobots });
    sayfalar.set(u, p);
    // sayfa duzeyinde sorun listesi -> "saglam" mi "sorunlu" mu
    const sorunlar = [];
    if (!p.title) sorunlar.push('title yok');
    if (!p.desc) sorunlar.push('description yok');
    if (p.h1 === 0) sorunlar.push('H1 yok');
    if (!p.canonical) sorunlar.push('canonical yok');
    if (p.kelime < INCE_ESIK) sorunlar.push(`ince icerik (${p.kelime} kelime)`);
    if (p.semaEksik.length) sorunlar.push(`schema alani eksik (${[...new Set(p.semaEksik)].slice(0, 2).join(', ')})`);
    if (p.imgYok) sorunlar.push(`${p.imgYok} gorselde alt yok`);
    if (p.noindex) sorunlar.push('noindex');
    kayit.push({ yol, kod: r.status, durum: sorunlar.length ? 'sorunlu' : 'saglam', sorunlar });
    p.icLink.forEach(l => { linkGrafi.set(l, (linkGrafi.get(l) || 0) + 1); });
    p.disLink.forEach(l => tumDisLink.add(l));
    // sitemap yoksa yeni ic linkleri kuyruga ekle
    if (!sm.varMi) p.icLink.forEach(l => { if (!gorulen.has(l) && ekQueue.length < MAX_SAYFA) ekQueue.push(l); });
    process.stdout.write(`  · ${sayfalar.size} sayfa\r`);
  }

  // 5) kirik link kontrol (ic + dis, sinirli)
  const kontrolListe = [...new Set([...linkGrafi.keys(), ...tumDisLink])].slice(0, MAX_LINK_KONTROL);
  const durumlar = await linkleriKontrol(kontrolListe);
  // gercek kirik: 404/410 (kesin), baglanti hatasi (0) veya 5xx (gecici olabilir).
  // 401/403/405/408/429/999 = bot-engelleme / rate-limit / erisim -> gercek kirik DEGIL (dis sosyal linkler bunu doner).
  const kesinKod = (kod) => kod === 404 || kod === 410;
  const geciciKod = (kod) => kod === 0 || (kod >= 500 && kod < 600);
  const kirikSayilir = (kod) => kesinKod(kod) || geciciKod(kod);
  // gecen taramada da kirik gorulen hedefler (gecici hatalari dogrulamak icin)
  const oncekiKirik = new Set((eski.kirikLinkler || []).map(k => k.hedef));

  // kaynak sayfa esle
  const kirikLinkler = [];
  for (const [sayfaUrl, p] of sayfalar) {
    for (const l of [...p.icLink, ...p.disLink]) {
      const kod = durumlar.get(l);
      if (kod != null && kirikSayilir(kod)) {
        const hedef = l.length > 60 ? l.slice(0, 60) + '…' : l;
        const ic = ayniHost(l, host);
        // Kesin kodlar hemen sayilir. Gecici kodlar (0/5xx) ancak onceki taramada da
        // kirikken sayilir -> tek seferlik sunucu kesintisi puani oynatmaz.
        const sayilir = kesinKod(kod) || oncekiKirik.has(hedef);
        kirikLinkler.push({ kaynak: new URL(sayfaUrl).pathname || '/', hedef, kod: kod || 0, ic, sayilir });
        if (kirikLinkler.length >= 50) break;
      }
    }
    if (kirikLinkler.length >= 50) break;
  }
  // Agirlik: kendi sitendeki kirik senin hatan (3), dis sitedeki link bir baskasinin
  // sunucusuna bagli (1). Dogrulanmamis gecici hatalar hic sayilmaz.
  const kirikCeza = kirikLinkler.reduce((a, k) => a + (k.sayilir ? (k.ic ? 3 : 1) : 0), 0);
  const kirikIc = kirikLinkler.filter(k => k.ic && k.sayilir).length;
  const kirikDogrulanmamis = kirikLinkler.filter(k => !k.sayilir).length;

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

  // schema eksik alanlari: hangi alan kac sayfada eksik + kac sayfa etkilenmis
  const semaSayac = {};
  list.forEach(p => p.semaEksik.forEach(a => { semaSayac[a] = (semaSayac[a] || 0) + 1; }));
  const semaEksikAlan = Object.entries(semaSayac).sort((a, b) => b[1] - a[1]).map(([alan, adet]) => ({ alan, adet }));
  const semaSorunluSayfa = list.filter(p => p.semaEksik.length).length;

  // ince icerik
  const inceSayfa = list.filter(p => p.kelime < INCE_ESIK).length;
  const ortKelime = toplam ? Math.round(list.reduce((a, p) => a + p.kelime, 0) / toplam) : 0;
  const inceOrnekler = [...sayfalar.entries()]
    .filter(([, p]) => p.kelime < INCE_ESIK)
    .map(([u, p]) => { try { return { yol: new URL(u).pathname, kelime: p.kelime }; } catch { return { yol: u, kelime: p.kelime }; } })
    .sort((a, b) => a.kelime - b.kelime).slice(0, 10);
  // orphan: taranan ama hicbir sayfadan ic link almayan (anasayfa haric)
  const orphan = [...sayfalar.keys()].filter(u => u !== normalize(kok) && !linkGrafi.has(u)).map(u => new URL(u).pathname).slice(0, 10);

  // sitemap erisilemez: sitemap URL'lerinden kacinin taramada 4xx/erisilemez oldugu (ornek: kontrol edilenler)
  let sitemapErisilemez = 0;
  if (sm.varMi) sm.urller.slice(0, 50).forEach(u => { const k = durumlar.get(normalize(u)); if (k != null && kirikSayilir(k)) sitemapErisilemez++; });

  // Tek anasayfa olcumu gurultulu (ayni site 300ms de olcuyor 4700ms de).
  // Taranan tum sayfalarin medyani stabil -> puanlamada bunu kullan.
  const medyan = (a) => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  };
  const medyanMs = medyan(sureler);
  uptime.medyanMs = medyanMs;

  // 6b) robots.txt ozeti + AI bot erisimi
  // Bot izinleri KUYRUKTAKI tum yollara gore hesaplanir (bizim taramadigimiz "engelli"
  // sayfalar da dahil) — Google/AI botunun gordugu tablo bu.
  const tumYollar = [...new Set([...kuyruk, ...gorulen].map(yolCek))];
  const botlar = botOzeti(rob, tumYollar);
  const robots = {
    varMi: robotsVar,
    sorun: rob.hatalar.length > 0,
    hatalar: rob.hatalar.slice(0, 5),
    sitemapSatiri: rob.sitemapler.length > 0,
    kuralSayisi: [...rob.gruplar.values()].reduce((a, g) => a + g.allow.length + g.disallow.length, 0),
    grupSayisi: rob.gruplar.size,
    aiSinyal: icerikSinyali(rob),
    bizeKapali: robotsVar ? tamamenKapali(rob, BOT_ADI) : false,
    botlar,
    engelliAi: botlar.filter(b => b.ai && !b.izin).length,
    toplamAi: botlar.filter(b => b.ai).length,
  };

  // 6c) sayfa durum kirilimi (Semrush "Crawled Pages" karsiligi) — her URL tek satir
  const say = (d) => kayit.filter(k => k.durum === d).length;
  const sayfaDurum = {
    toplam: kayit.length,
    saglam: say('saglam'), sorunlu: say('sorunlu'), kirik: say('kirik'),
    yonlendirme: say('yonlendirme'), engelli: say('engelli'),
  };
  const sec = (d, n) => kayit.filter(k => k.durum === d).slice(0, n);

  // 6d) SORUN LISTESI — panelin "Sorunlar" bolumunun kaynagi.
  // Iki parca birlesir:
  //   (a) sorun-tespit.js'in urettigi YENI bulgular (yinelenen title/desc/icerik,
  //       coklu H1, baslik atlamasi, canonical cakismasi, yonlendirme zinciri/dongusu,
  //       derin sayfa, giden link yok, title/desc uzunlugu, yavas yanit, engellenen sayfa)
  //   (b) zaten olculen ESKI kontroller — ayni katalog altina alindi ki panelde
  //       "bir sorunun aciklamasi ve cozumu" tek yerden gelsin.
  // Seviye/aciklama/cozum metinleri assets/sorun-katalogu.js'te.
  const yolHarita = new Map([...sayfalar.keys()].map(u => [u, yolCek(u)]));
  const sorunlar = siteSorunlari({ kok: normalize(kok), sayfalar, kayit, yollar: yolHarita, sureler: sayfaSure });

  // (b) mevcut kontrolleri ayni bicime cevir
  const ornekYollar = (kosul, n = 10) => [...sayfalar.entries()].filter(([, p]) => kosul(p))
    .slice(0, n).map(([u, p]) => ({ yol: yolHarita.get(u), deger: null }));
  const eskiEkle = (tip, adet, ornekler) => { if (adet > 0) sorunlar.push({ tip, adet, ornekler: ornekler || [] }); };
  eskiEkle('title-yok', eksikMeta.title, ornekYollar(p => !p.title));
  eskiEkle('description-yok', eksikMeta.description, ornekYollar(p => !p.desc));
  eskiEkle('h1-yok', eksikMeta.h1, ornekYollar(p => p.h1 === 0));
  eskiEkle('canonical-yok', canonicalEksik, ornekYollar(p => !p.canonical));
  eskiEkle('ince-icerik', inceSayfa, inceOrnekler.map(o => ({ yol: o.yol, deger: `${o.kelime} kelime` })));
  eskiEkle('alt-eksik', altEksik, ornekYollar(p => p.imgYok > 0).map(o => ({ ...o, deger: null })));
  eskiEkle('oksuz-sayfa', orphan.length, orphan.map(y => ({ yol: y, deger: null })));
  eskiEkle('schema-alan-eksik', semaSorunluSayfa, semaEksikAlan.slice(0, 10).map(a => ({ yol: `${a.adet} sayfa`, deger: a.alan })));
  if (!schemaGecerli) sorunlar.push({ tip: 'schema-yok', adet: 1, ornekler: [] });
  eskiEkle('kirik-ic-link', kirikIc, kirikLinkler.filter(k => k.ic && k.sayilir).slice(0, 10)
    .map(k => ({ yol: k.kaynak, deger: `-> ${k.hedef} (${k.kod})` })));
  if (!llms.varMi) sorunlar.push({ tip: 'llms-yok', adet: 1, ornekler: [] });
  if (robots.bizeKapali) sorunlar.push({ tip: 'robots-tamamen-kapali', adet: 1, ornekler: [] });
  eskiEkle('robots-sozdizimi', robots.hatalar.length, robots.hatalar.map(h => ({ yol: `satir ${h.satirNo}`, deger: h.satir || null })));

  // SEO puani (0-100 basit heuristik)
  let puan = 100;
  puan -= Math.min(20, kirikCeza);
  puan -= Math.min(12, eksikMeta.description * 1);
  puan -= Math.min(8, eksikMeta.title * 2);
  puan -= Math.min(8, eksikMeta.h1 * 1);
  puan -= schemaGecerli ? 0 : 8;
  puan -= sm.varMi ? 0 : 8;
  puan -= robotsVar ? 0 : 4;
  puan -= canonicalEksik > 0 ? Math.min(6, canonicalEksik) : 0;
  puan -= ortLink < 5 ? 5 : 0;
  puan -= orphan.length ? Math.min(6, orphan.length) : 0;
  puan -= altEksik > 10 ? 4 : 0;
  puan -= tracking.length ? 0 : 4;
  // kademeli: sert esik yerine iki basamak (medyan zaten stabil, ama ucurum yaratmasin)
  const yanit = medyanMs ?? uptime.yanitMs ?? 0;
  puan -= yanit > 3000 ? 6 : yanit > 1500 ? 3 : 0;
  // Bu uc kontrol ORANSAL: 30/60 sayfa ile 300/600 sayfa ayni cezayi alir.
  // (Ustteki eski kontroller mutlak sayiya bakiyor — bilincli fark, bkz. README.)
  puan -= Math.round((toplam ? semaSorunluSayfa / toplam : 0) * 10);
  puan -= Math.round((toplam ? inceSayfa / toplam : 0) * 8);
  puan -= llms.varMi ? 0 : 2;
  puan = Math.max(0, Math.min(100, Math.round(puan)));

  return {
    seo: { puan },
    // Sorun listesi puana GIRMEZ (katalogdaki puana:false olanlar). Puan formulu
    // eski taramalarla karsilastirilabilir kalsin diye dondurulmus durumda.
    sorunlar,
    uptime, ssl,
    sayfalar: { taranan: toplam, indekslenebilir: toplam - noindex, noindex },
    sayfaYollari: [...sayfalar.keys()].map(u => { try { return new URL(u).pathname; } catch { return u; } }).slice(0, 150),
    kirikLinkler,
    kirikOzet: { ic: kirikIc, dis: kirikLinkler.filter(k => !k.ic && k.sayilir).length, dogrulanmamis: kirikDogrulanmamis },
    eksikMeta,
    schema: { varMi: schemaVar, gecerli: schemaGecerli, tipler: schemaTipler,
      eksikAlan: semaEksikAlan, sorunluSayfa: semaSorunluSayfa },
    icerik: { ortKelime, inceSayfa, esik: INCE_ESIK, ornekler: inceOrnekler },
    llms,
    sitemap: { varMi: sm.varMi, urlSayisi: sm.urller.length, erisilemez: sitemapErisilemez, dosyalar: sm.dosyalar },
    robots,
    sayfaDurum,
    // ornek listeler: panelde "hangi sayfa" sorusunu cevaplar, dosyayi sismesin diye sinirli
    kirikSayfalar: sec('kirik', 30),
    yonlendirmeler: sec('yonlendirme', 30),
    engelliSayfalar: sec('engelli', 30),
    sorunluSayfalar: sec('sorunlu', 50),
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

  // --site=<id>: sadece o siteyi tara, digerlerini onceki data.json'dan oldugu gibi koru.
  // (Tek siteyi dogrulamak icin 5 siteyi bastan taramak gerekmesin.)
  const argSite = (process.argv.find(a => a.startsWith('--site=')) || '').split('=')[1] || null;
  const aktif = (cfg.siteler || []).filter(s => s.aktif !== false && s.url && (!argSite || s.id === argSite));
  if (argSite && !aktif.length) { console.error(`✕ --site=${argSite}: sites.config.json'da boyle bir aktif site yok`); process.exit(1); }
  const siteler = [];
  const basarisizlar = [];   // saglik kontrolunden gecemeyen taramalar

  for (const site of aktif) {
    const eski = oncekiSiteler[site.id] || {};
    let tarama;
    try { tarama = await siteTara(site, eski); }
    catch (e) { console.error(`\n  ✕ ${site.ad} hata: ${e.message}`); continue; }

    // Tarama saglik kontrolu: WAF/challenge sayfasi gelmisse sonuc "gercek veri"
    // degildir. Iyi verinin ustune yazmak yerine onceki kaydi oldugu gibi koru ve
    // sitenin uzerine "taramaHatasi" isareti birak (panel + Telegram bunu gosterir).
    const dogrulama = taramaDogrula(tarama, eski);
    if (!dogrulama.gecerli) {
      basarisizlar.push({ id: site.id, ad: site.ad, dogrulama });
      console.error(`\n  ✕ ${site.ad}: TARAMA BASARISIZ — onceki veri korundu (${dogrulama.ozet})`);
      dogrulama.neden.forEach(n => console.error(`     · ${n.kod}: ${n.mesaj}`));
      siteler.push({
        ...eski,
        id: site.id, ad: site.ad, url: site.url, aktif: true,
        taramaHatasi: {
          tarih: bugun(),
          sayfa: tarama.sayfalar?.taranan ?? 0,
          oncekiSayfa: eski.sayfalar?.taranan ?? 0,
          neden: dogrulama.neden,
          mesaj: 'Tarama engellendi (muhtemelen WAF/bot dogrulamasi) — veriler son basarili taramadan.',
        },
      });
      continue;
    }

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
    const ko = tarama.kirikOzet, sd = tarama.sayfaDurum, rb = tarama.robots;
    process.stdout.write(`  ✓ ${site.ad}: puan ${tarama.seo.puan}, ${tarama.sayfalar.taranan} sayfa, kirik ${ko.ic} ic / ${ko.dis} dis${ko.dogrulanmamis ? ` (+${ko.dogrulanmamis} dogrulanmamis)` : ''}\n`);
    process.stdout.write(`     durum: ${sd.saglam} saglam · ${sd.sorunlu} sorunlu · ${sd.kirik} kirik · ${sd.yonlendirme} yonlendirme · ${sd.engelli} engelli` +
      ` | AI botu: ${rb.toplamAi - rb.engelliAi}/${rb.toplamAi} serbest\n`);
  }

  // --site= ile tek site tarandiysa digerleri onceki dosyadan aynen tasinir
  const tumSiteler = argSite
    ? [...(onceki.siteler || []).filter(s => s.id !== argSite), ...siteler]
        .sort((a, b) => (cfg.siteler || []).findIndex(c => c.id === a.id) - (cfg.siteler || []).findIndex(c => c.id === b.id))
    : siteler;

  // ozet
  const ortalama = tumSiteler.length ? Math.round(tumSiteler.reduce((a, s) => a + s.seo.puan, 0) / tumSiteler.length) : 0;
  const toplamKirik = tumSiteler.reduce((a, s) => a + s.kirikLinkler.length, 0);

  // uyarilar
  const uyarilar = [];
  tumSiteler.forEach(s => {
    // Tarama basarisizsa asagidaki bulgular ESKI (son basarili) taramadan gelir;
    // once bunu soyle ki panelde/raporda kimse bayat veriye bakip is yapmasin.
    if (s.taramaHatasi) uyarilar.push({ seviye: 'kritik', site: s.id,
      mesaj: `Tarama basarisiz (${s.taramaHatasi.tarih.slice(0, 10)}): ${s.taramaHatasi.neden.map(n => n.kod).join(', ')} — veriler son basarili taramadan, puan guncellenmedi` });
    if (s.ssl?.gecerli && s.ssl.kalanGun <= 30) uyarilar.push({ seviye: s.ssl.kalanGun <= 14 ? 'kritik' : 'uyari', site: s.id, mesaj: `SSL sertifikasi ${s.ssl.kalanGun} gun sonra doluyor (${s.ssl.bitis})` });
    if (!s.ssl?.gecerli) uyarilar.push({ seviye: 'kritik', site: s.id, mesaj: 'SSL sertifikasi gecersiz/erisilemez' });
    if (s.uptime?.durum === 'down') uyarilar.push({ seviye: 'kritik', site: s.id, mesaj: 'Site erisilemez (down)' });
    if (!s.sitemap?.varMi) uyarilar.push({ seviye: 'uyari', site: s.id, mesaj: 'sitemap.xml bulunamadi' });
    // robots.txt / AI bot erisimi
    const rb = s.robots || {};
    if (rb.bizeKapali) uyarilar.push({ seviye: 'kritik', site: s.id, mesaj: 'robots.txt bu taramayi engelliyor — sayfalar denetlenemedi' });
    if (rb.sorun) uyarilar.push({ seviye: 'uyari', site: s.id, mesaj: `robots.txt'te ${rb.hatalar.length} sozdizimi hatasi (satir ${rb.hatalar.map(h => h.satirNo).join(', ')})` });
    if (rb.engelliAi) {
      const kapali = (rb.botlar || []).filter(b => b.ai && !b.izin).map(b => b.ad);
      uyarilar.push({ seviye: 'uyari', site: s.id, mesaj: `${rb.engelliAi}/${rb.toplamAi} AI botu robots.txt ile engelli (${kapali.slice(0, 4).join(', ')}${kapali.length > 4 ? '…' : ''}) — AI cevaplarinda kaynak gosterilemezsin` });
    }
    if (s.sayfaDurum?.kirik) uyarilar.push({ seviye: 'uyari', site: s.id, mesaj: `${s.sayfaDurum.kirik} sayfa taramada hata verdi (404/5xx)` });
    if (s.kirikOzet?.ic) uyarilar.push({ seviye: 'uyari', site: s.id, mesaj: `${s.kirikOzet.ic} kirik IC link — kendi sayfalarina 404 veriyor` });
    if (s.kirikOzet?.dis) uyarilar.push({ seviye: 'bilgi', site: s.id, mesaj: `${s.kirikOzet.dis} kirik dis link — hedef site kapanmis, linki kaldir` });
    if (s.hreflang?.sorun) uyarilar.push({ seviye: 'uyari', site: s.id, mesaj: 'hreflang etiketleri eksik/tutarsiz' });
    if (s.schema?.sorunluSayfa) uyarilar.push({ seviye: 'uyari', site: s.id, mesaj: `${s.schema.sorunluSayfa} sayfada schema alani eksik (${s.schema.eksikAlan[0]?.alan}) — zengin sonuc cikmaz` });
    if (s.icerik?.inceSayfa) uyarilar.push({ seviye: 'uyari', site: s.id, mesaj: `${s.icerik.inceSayfa} sayfa ${s.icerik.esik} kelimenin altinda (ince icerik)` });
    if (s.llms && !s.llms.varMi) uyarilar.push({ seviye: 'uyari', site: s.id, mesaj: 'llms.txt yok — AI motorlari icin site ozeti ekle' });
  });
  const acilUyari = uyarilar.filter(u => u.seviye === 'kritik').length;

  // degisiklikler (onceki taramaya gore)
  const degisiklikler = [];
  siteler.forEach(s => {
    const e = oncekiSiteler[s.id]; if (!e) return;
    if (e.seo?.puan != null && e.seo.puan !== s.seo.puan)
      degisiklikler.push({ site: s.id, tip: s.seo.puan > e.seo.puan ? 'artis' : 'dusus', mesaj: `SEO puani ${e.seo.puan} → ${s.seo.puan} (${s.seo.trend})`, tarih: bugun().slice(0, 10) });
    // Sadece DOGRULANMIS kiriklar sayilir — gecici hatalar (0/5xx) puana girmedigi gibi
    // "yeni kirik link" uyarisi da uretmemeli, yoksa her sunucu hickirigi alarm oluyor.
    const sayilirAdet = (x) => (x.kirikLinkler || []).filter(k => k.sayilir).length;
    const yeniKirik = sayilirAdet(s) - sayilirAdet(e);
    if (yeniKirik > 0) degisiklikler.push({ site: s.id, tip: 'yeni-kirik', mesaj: `${yeniKirik} yeni kirik link`, tarih: bugun().slice(0, 10) });
    const sayfaFark = s.sayfalar.taranan - (e.sayfalar?.taranan || 0);
    if (sayfaFark !== 0) degisiklikler.push({ site: s.id, tip: sayfaFark > 0 ? 'yeni-sayfa' : 'silinen-sayfa', mesaj: `${Math.abs(sayfaFark)} sayfa ${sayfaFark > 0 ? 'eklendi' : 'azaldi'}`, tarih: bugun().slice(0, 10) });
  });

  // Tarama dakikalar sürer; bu sırada "npm run rapor" veya "npm run icerik" çalışıp
  // data.json'a yeni kayıt eklemiş olabilir. Bu yüzden taramanın BASINDA okunan
  // `onceki` yerine dosyayı TEKRAR okuyup taşınacak alanları oradan alıyoruz —
  // yoksa tarama biterken o kayıtlar sessizce siliniyor.
  let sonHal = onceki;
  try { sonHal = JSON.parse(fs.readFileSync(veriYolu, 'utf8')); } catch {}

  const cikti = {
    guncelleme: bugun(),
    ozet: { toplamSite: tumSiteler.length, ortalamaSeoPuan: ortalama, toplamKirikLink: toplamKirik, acilUyari },
    siteler: tumSiteler,
    degisiklikler,
    raporlar: sonHal.raporlar || onceki.raporlar || [],
    uretilenIcerikler: sonHal.uretilenIcerikler || onceki.uretilenIcerikler || [],
    uyarilar,
  };

  fs.mkdirSync(path.dirname(veriYolu), { recursive: true });
  fs.writeFileSync(veriYolu, JSON.stringify(cikti, null, 2));
  // arsiv
  const arsivDizin = path.join(KOK, 'data', 'history');
  fs.mkdirSync(arsivDizin, { recursive: true });
  fs.writeFileSync(path.join(arsivDizin, bugun().slice(0, 10) + '.json'), JSON.stringify(cikti, null, 2));
  // panel fallback (file:// icin)
  fs.mkdirSync(path.join(KOK, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(KOK, 'assets', 'fallback-data.js'), 'window.SEO_FALLBACK = ' + JSON.stringify(cikti) + ';\n');

  const basarili = siteler.length - basarisizlar.length;
  console.log(`\n✅ Bitti. ${basarili}/${siteler.length} site basariyla tarandi, ortalama puan ${ortalama}, ${toplamKirik} kirik link, ${uyarilar.length} uyari.`);
  console.log(`   → data/data.json guncellendi.`);
  if (basarisizlar.length) {
    console.log(`\n⚠️  ${basarisizlar.length} sitede tarama BASARISIZ — o sitelerin verisi son basarili taramadan korundu:`);
    basarisizlar.forEach(b => console.log(`   · ${b.ad}: ${b.dogrulama.neden.map(n => n.kod).join(', ')}`));
    console.log('   Muhtemel sebep: WAF/bot dogrulamasi (Cloudflare vb.) tarayiciyi challenge sayfasina dusuruyor.');
    console.log('   Cozum: WAF\'ta bu tarayicinin User-Agent\'ina veya IP\'sine izin ver, sonra taramayi tekrar calistir.');
  }
}

main().catch(e => { console.error('HATA:', e); process.exit(1); });
