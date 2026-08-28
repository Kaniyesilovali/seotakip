// scripts/indeks.js
// GERCEK indeks durumu: Google Search Console URL Inspection API.
//
// NEDEN AYRI SCRIPT: Sitemaps API'sindeki "indexed" alani kullanimdan kalkti (hep 0 doner).
// Gercek durum yalnizca URL Inspection API'den gelir; bu API URL BASINA 1 istek harcar
// (kota: site basina gunde 2000, dakikada 600). O yuzden sonuclar cache'lenir ve her calismada
// yalnizca "bayatlamis" URL'ler yeniden sorulur -> gunluk otomatik tarama kotayi yakmaz.
//
// IZIN NOTU: searchAnalytics icin "Sinirli" kullanici yeterdi, URL Inspection ICIN YETMEZ.
// GSC -> Ayarlar -> Kullanicilar ve izinler -> servis hesabina "Tam" (veya sahip) izni ver.
//
// Calistir:
//   node scripts/indeks.js                 # site basina en fazla 100 URL, 7 gunden eski olanlar
//   node scripts/indeks.js --limit=300     # bu calismada site basina 300 URL sor
//   node scripts/indeks.js --tazelik=3     # 3 gunden eski kayitlari tazele
//   node scripts/indeks.js --site=animare  # tek site

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JWT } from 'google-auth-library';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..');
const veriYolu = path.join(KOK, 'data', 'data.json');
const cacheYolu = path.join(KOK, 'data', 'indeks-cache.json');
const cfg = JSON.parse(fs.readFileSync(path.join(KOK, 'sites.config.json'), 'utf8'));

// ---- parametreler ----
const arg = (k, varsayilan) => {
  const m = process.argv.find(a => a.startsWith(`--${k}=`));
  return m ? m.split('=')[1] : varsayilan;
};
const LIMIT = +arg('limit', 100);        // bu calismada site basina en fazla kac URL sorulacak
const TAZELIK_GUN = +arg('tazelik', 7);  // bu kadar gunden eski kayitlar yeniden sorulur
const TEK_SITE = arg('site', null);
const ESZAMANLI = 3;                     // paralel istek (dakikalik kotaya rahat siginir)

// ---- servis hesabi anahtari ----
function envDeger(k) {
  try { const e = fs.readFileSync(path.join(KOK, '.env'), 'utf8'); const m = e.match(new RegExp('^\\s*' + k + '\\s*=\\s*(.+?)\\s*$', 'm')); return m ? m[1].replace(/^["']|["']$/g, '') : ''; } catch { return ''; }
}
const KEY_FILE = process.env.GSC_KEY_FILE || envDeger('GSC_KEY_FILE') || path.join(KOK, 'gsc-key.json');
if (!fs.existsSync(KEY_FILE)) {
  console.error(`✕ Servis hesabi anahtari yok: ${KEY_FILE}\n  README'deki "Search Console kurulumu" adimlarini izle.`);
  process.exit(1);
}
const anahtar = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
const client = new JWT({ email: anahtar.client_email, key: anahtar.private_key, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });

// ---- GSC'nin dondurdugu "coverageState" metinlerini TR'ye ve aksiyona cevir ----
// sorun:false  -> normal durum, oneri uretilmez
// sorun:true   -> gercek problem, panelde oneri cikar
//
// DIKKAT: API'ye languageCode:'en' gonderiyoruz ki metinler sabit kalsin, ama Google bunu her
// zaman dinlemiyor -> her kalip hem EN hem TR karsiligiyla yazildi. SIRA ONEMLI: "dizine eklenmedi"
// kaliplari "dizine eklendi"den ONCE gelmeli, yoksa yanlis eslesir.
const NEDENLER = [
  [/crawled\s*[-–]\s*currently not indexed|tarand[ıi].*dizine eklenmedi/i,
    { tr: 'Tarandı — şu anda indekslenmedi', sorun: true, cozum: 'Kalite sorunu: içerik ince/kopya. Derinleştir, özgünleştir, iç link ver.' }],
  [/discovered\s*[-–]\s*currently not indexed|bulundu.*dizine eklenmedi/i,
    { tr: 'Bulundu — şu anda indekslenmedi', sorun: true, cozum: 'Tarama bütçesi zayıf: iç linkleme artır, sitemap\'i temizle, sunucuyu hızlandır.' }],
  [/duplicate.*google chose different|yinelenen.*google.*farkl[ıi]/i,
    { tr: 'Yinelenen — Google farklı canonical seçti', sorun: true, cozum: 'Sayfalar fazla benziyor. Birleştir veya gerçekten farklılaştır.' }],
  [/duplicate.*not selected as canonical|yinelenen.*kurall[ıi] olarak se[çc]ilmedi/i,
    { tr: 'Yinelenen — gönderilen URL canonical seçilmedi', sorun: true, cozum: 'Canonical etiketini ve iç linkleri tek hedefe yönlendir.' }],
  [/duplicate without user-selected|yinelenen.*se[çc]ilen kurall[ıi]/i,
    { tr: 'Yinelenen — canonical belirtilmemiş', sorun: true, cozum: 'Sayfaya rel="canonical" ekle.' }],
  [/noindex/i,
    { tr: '\'noindex\' etiketiyle hariç tutuldu', sorun: true, cozum: 'Kasıtlı değilse <meta name="robots" content="noindex"> etiketini kaldır.' }],
  [/blocked by robots|robots\.txt taraf[ıi]ndan engellendi/i,
    { tr: 'robots.txt tarafından engellendi', sorun: true, cozum: 'robots.txt\'teki Disallow kuralını kaldır.' }],
  [/not found \(404\)|bulunamad[ıi] \(404\)/i,
    { tr: 'Bulunamadı (404)', sorun: true, cozum: 'Sitemap\'ten çıkar veya doğru sayfaya 301 ver.' }],
  [/soft 404|ge[çc]ici 404/i,
    { tr: 'Soft 404 (boş görünüyor)', sorun: true, cozum: 'Sayfa içerik döndürmüyor. JS ile geç yüklenen içerik varsa sunucudan bas.' }],
  [/server error|sunucu hatas[ıi]/i,
    { tr: 'Sunucu hatası (5xx)', sorun: true, cozum: 'Hosting/uygulama loglarına bak — Googlebot hata alıyor.' }],
  [/unauthorized request|yetkisiz|\(401\)/i,
    { tr: 'Yetkisiz istek (401)', sorun: true, cozum: 'Sayfa kimlik doğrulama istiyor. Herkese açık olmalıysa aç.' }],
  [/access forbidden|eri[şs]im yasak|\(403\)/i,
    { tr: 'Erişim engellendi (403)', sorun: true, cozum: 'Sunucu/WAF Googlebot\'u engelliyor olabilir. IP/UA kurallarını kontrol et.' }],
  [/other 4xx|di[ğg]er 4xx/i,
    { tr: 'Diğer 4xx hatası', sorun: true, cozum: 'URL\'i tarayıcıda ve curl ile test et.' }],
  [/unknown to google|google taraf[ıi]ndan bilinmiyor/i,
    { tr: 'Google bu URL\'i bilmiyor', sorun: true, cozum: 'Sitemap\'e ekle ve bir yerden iç link ver.' }],
  [/removed|removal|kald[ıi]rma iste|kald[ıi]r[ıi]ld[ıi]/i,
    { tr: 'Kullanıcı isteğiyle kaldırıldı', sorun: false, cozum: 'Kasıtlı değilse GSC → Kaldırmalar\'dan iptal et.' }],
  // --- normal durumlar (oneri uretmez) ---
  [/alternate page|alternatif sayfa/i,
    { tr: 'Alternatif sayfa (canonical doğru)', sorun: false, cozum: 'Normal. Canonical başka sayfayı gösteriyor.' }],
  [/page with redirect|y[öo]nlendirme i[çc]eren/i,
    { tr: 'Yönlendirme içeren sayfa', sorun: false, cozum: 'Normal. Sitemap\'te duruyorsa çıkar.' }],
  [/indexed, not submitted|dizine eklendi.*g[öo]nderilmedi/i,
    { tr: 'İndeksli (sitemap\'te yok)', sorun: false, cozum: 'Sitemap\'e ekle — zararı yok ama düzen için.' }],
  [/submitted and indexed|g[öo]nderildi ve dizine eklendi/i,
    { tr: 'Gönderildi ve indekslendi', sorun: false }],
];
function nedenBilgi(coverageState, verdict) {
  const s = coverageState || 'Bilinmiyor';
  for (const [re, bilgi] of NEDENLER) if (re.test(s)) return { ...bilgi, ham: s };
  // Taninmayan metin: indeksli bir sayfa icin asla aksiyon uretme (yeni/degismis GSC metnine karsi guvenlik).
  return { tr: s, sorun: verdict !== 'PASS', cozum: 'Search Console → URL Denetleme ile bu URL\'i incele.', ham: s };
}

// ---- property bulma: servis hesabinin erisebildigi property'leri listele, host'a gore es ----
async function propertyBul(siteUrl) {
  let liste = [];
  try {
    const res = await client.request({ url: 'https://searchconsole.googleapis.com/webmasters/v3/sites' });
    liste = res.data.siteEntry || [];
  } catch (e) { return { hata: `property listesi alinamadi: ${e.message}` }; }

  const host = new URL(siteUrl).host.replace(/^www\./, '');
  const sirali = [`sc-domain:${host}`, `https://${host}/`, `https://www.${host}/`, `http://${host}/`, `http://www.${host}/`];
  for (const aday of sirali) {
    const bulunan = liste.find(e => e.siteUrl === aday);
    if (bulunan) return { property: aday, izin: bulunan.permissionLevel };
  }
  return { hata: `bu hesap ${host} property'sine ekli degil` };
}

// ---- URL'in GERCEK halini bul ----
// crawl.js'teki normalize() sondaki slash'i kirpiyor (kendi tekillestirmesi icin dogru), ama
// URL Inspection TAM ESLESME ister: site /tr -> /tr/ 301 yapiyorsa Google "/tr/"i bilir,
// "/tr" sorulunca "URL Google tarafindan bilinmiyor" doner. O yuzden once yonlendirmeyi cozeriz.
const UA = cfg.ayarlar?.kullaniciAjani || 'SeoTakipBot/1.0';
async function gercekUrl(u) {
  for (const method of ['HEAD', 'GET']) {   // bazi sunucular HEAD'i reddeder -> GET'e dus
    try {
      const res = await fetch(u, { method, redirect: 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(cfg.ayarlar?.zamanAsimiMs || 15000) });
      if (method === 'HEAD' && (res.status === 405 || res.status === 501)) continue;
      return { url: res.url || u, kod: res.status };
    } catch { /* GET'i dene */ }
  }
  return { url: u, kod: 0 };
}

// ---- tek URL denetle ----
async function urlDenetle(property, inspectionUrl) {
  const res = await client.request({
    url: 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
    method: 'POST',
    data: { inspectionUrl, siteUrl: property, languageCode: 'en' },
  });
  const r = res.data.inspectionResult?.indexStatusResult || {};
  return {
    t: new Date().toISOString(),
    denetlenen: inspectionUrl,
    verdict: r.verdict || 'BILINMIYOR',              // PASS / PARTIAL / FAIL / NEUTRAL
    durum: r.coverageState || '',                     // "Crawled - currently not indexed" vb.
    robots: r.robotsTxtState || '',
    indeksleme: r.indexingState || '',                // INDEXING_ALLOWED / BLOCKED_BY_META_TAG ...
    getirme: r.pageFetchState || '',
    canonicalGoogle: r.googleCanonical || '',
    canonicalSayfa: r.userCanonical || '',
    sonTarama: r.lastCrawlTime || '',
  };
}

// ---- basit is havuzu ----
async function havuz(isler, esZamanli, calistir) {
  const sonuc = new Array(isler.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(esZamanli, isler.length) }, async () => {
    while (i < isler.length) {
      const k = i++;
      sonuc[k] = await calistir(isler[k], k);
    }
  }));
  return sonuc;
}

// ---- ana ----
async function main() {
  const veri = JSON.parse(fs.readFileSync(veriYolu, 'utf8'));
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cacheYolu, 'utf8')); } catch {}

  let aktif = (cfg.siteler || []).filter(s => s.aktif !== false && s.url);
  if (TEK_SITE) aktif = aktif.filter(s => s.id === TEK_SITE);

  console.log(`🔍 Indeks denetimi (URL Inspection API) — site basina en fazla ${LIMIT} URL, ${TAZELIK_GUN} gunden eskiler tazelenir`);
  console.log(`   servis hesabi: ${anahtar.client_email}`);

  const bayatSinir = Date.now() - TAZELIK_GUN * 864e5;
  let guncellenen = 0;

  for (const site of aktif) {
    process.stdout.write(`\n▶ ${site.ad} … `);
    const hedef = veri.siteler.find(s => s.id === site.id);
    if (!hedef) { console.log('✕ data.json\'da yok — once crawl.js calistir'); continue; }

    // denetlenecek URL listesi: crawler'in bulduğu sayfa yollari
    const yollar = hedef.sayfaYollari?.length ? hedef.sayfaYollari : ['/'];
    const kok = site.url.replace(/\/$/, '');
    const urller = [...new Set(yollar.map(y => kok + (y.startsWith('/') ? y : '/' + y)))];

    const siteCache = cache[site.id] = cache[site.id] || {};
    // cache'te olmayan veya bayatlamis olanlar; en eski once (gunler icinde tum liste doner)
    const sorulacak = urller
      .filter(u => !siteCache[u] || Date.parse(siteCache[u].t) < bayatSinir)
      .sort((a, b) => (Date.parse(siteCache[a]?.t) || 0) - (Date.parse(siteCache[b]?.t) || 0))
      .slice(0, LIMIT);

    process.stdout.write(`${urller.length} sayfa, ${sorulacak.length} denetlenecek `);

    let kotaBitti = false, hataliSayi = 0, property = null;

    // API'ye YALNIZCA sorulacak URL varsa git (hepsi taze ise kota harcanmaz).
    // Property/izin sorunu ozeti durdurmaz: cache'te veri varsa ondan rapor cikar.
    if (sorulacak.length) {
      const p = await propertyBul(site.url);
      if (p.hata) { console.log(`\n  ✕ ${p.hata}`); }
      else if (p.izin === 'siteRestrictedUser') {
        console.log(`\n  ✕ izin yetersiz (${p.izin}) — GSC > Ayarlar > Kullanicilar ve izinler: servis hesabina "Tam" izin ver`);
      } else property = p.property;
    }

    let yonlendirilen = 0;
    if (property) await havuz(sorulacak, ESZAMANLI, async (u) => {
      if (kotaBitti) return;
      try {
        const g = await gercekUrl(u);
        if (g.url !== u) yonlendirilen++;
        siteCache[u] = { ...await urlDenetle(property, g.url), httpKod: g.kod };
        process.stdout.write('.');
      } catch (e) {
        const kod = e.response?.status;
        if (kod === 429) { kotaBitti = true; process.stdout.write('⏸'); }
        else if (kod === 403) { kotaBitti = true; console.log(`\n  ✕ 403 — servis hesabinin izni "Tam" degil`); }
        else { hataliSayi++; process.stdout.write('x'); }
      }
    });

    // ---- ozet cikar (cache'teki TUM URL'ler uzerinden, sadece bu turdakiler degil) ----
    const kayitlar = urller.map(u => ({ url: u, k: siteCache[u] })).filter(x => x.k);
    if (!kayitlar.length) { console.log('  — hic sonuc yok, indeks alani bos birakildi'); continue; }

    const sayac = new Map();
    let indeksli = 0;
    const sorunlu = [];
    for (const { url, k } of kayitlar) {
      const n = nedenBilgi(k.durum, k.verdict);
      if (k.verdict === 'PASS') indeksli++;
      const mevcut = sayac.get(n.tr) || { neden: n.tr, adet: 0, sorun: n.sorun, cozum: n.cozum || '', ornekler: [] };
      mevcut.adet++;
      if (mevcut.ornekler.length < 3) mevcut.ornekler.push(new URL(url).pathname);
      sayac.set(n.tr, mevcut);
      if (n.sorun) sorunlu.push({ yol: new URL(url).pathname, neden: n.tr, cozum: n.cozum || '' });
    }
    const nedenler = [...sayac.values()].sort((a, b) => b.adet - a.adet);
    const oncekiIndeksli = hedef.indeks?.indeksli;

    hedef.indeks = {
      indeksli,
      indekssiz: kayitlar.length - indeksli,
      aksiyonGereken: sorunlu.length,
      kontrolEdilen: kayitlar.length,
      toplamSayfa: urller.length,
      dususVar: oncekiIndeksli != null && indeksli < oncekiIndeksli,
      nedenler,
      sorunlu: sorunlu.slice(0, 50),
      tarih: new Date().toISOString(),
    };
    hedef._indeksGercek = true;

    console.log(`\n  ✓ ${indeksli}/${kayitlar.length} indeksli, ${sorunlu.length} aksiyon gerektiren [${property || 'cache'}]`);
    nedenler.forEach(n => console.log(`     ${n.sorun ? '⚠' : '·'} ${n.adet.toString().padStart(3)} — ${n.neden}`));
    if (yonlendirilen) console.log(`     ↪ ${yonlendirilen} URL yonlendirildi, son hali denetlendi (ornek: ${siteCache[sorulacak[0]]?.denetlenen || '-'})`);
    if (kotaBitti) console.log('     ⏸ gunluk kota doldu, kalanlar yarinki calismada sorulacak');
    if (hataliSayi) console.log(`     x ${hataliSayi} URL denetlenemedi`);
    guncellenen++;
  }

  veri.guncelleme = new Date().toISOString();
  fs.writeFileSync(veriYolu, JSON.stringify(veri, null, 2));
  fs.writeFileSync(cacheYolu, JSON.stringify(cache, null, 2));
  fs.writeFileSync(path.join(KOK, 'assets', 'fallback-data.js'), 'window.SEO_FALLBACK = ' + JSON.stringify(veri) + ';\n');
  console.log(`\n${guncellenen ? '✅' : '✕'} Indeks: ${guncellenen}/${aktif.length} site guncellendi.`);
  // searchconsole.js ile ayni kural: hicbir site guncellenmediyse is YESIL gorunmesin.
  // Sessiz basari, veriyi haftalarca dondurup panelde bayat sayiyi taze gibi gosteriyordu.
  if (!guncellenen) {
    console.error('\n✕ Hicbir siteden indeks verisi alinamadi — indeks durumu TAZELENMEDI.');
    console.error('  URL Inspection API "Sinirli" izinle CALISMAZ: GSC > Ayarlar > Kullanicilar ve izinler');
    console.error(`  -> servis hesabina "Tam" izin ver: ${anahtar.client_email}`);
    process.exit(1);
  }
}

main().catch(e => { console.error('HATA:', e.message); process.exit(1); });
