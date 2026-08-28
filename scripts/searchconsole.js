// scripts/searchconsole.js
// Google Search Console'dan GERCEK siralama + anahtar kelime + firsat (icerik boslugu) verisi ceker.
// Ucretsiz. Servis hesabi ile calisir (interaktif OAuth yok -> GitHub Actions'ta da calisir).
//
// KURULUM (bir kez):
//   1) Google Cloud Console -> yeni proje -> "Search Console API"yi etkinlestir
//   2) IAM & Admin -> Service Accounts -> hesap olustur -> JSON anahtar indir
//   3) JSON'u proje kokune "gsc-key.json" olarak koy (gitignore'da, repoya gitmez)
//   4) Her GSC property'sinde: Ayarlar -> Kullanicilar ve izinler -> Kullanici ekle
//      -> servis hesabinin e-postasi (xxx@proje.iam.gserviceaccount.com) -> "Sinirli" yeter
//
// Calistir:  node scripts/searchconsole.js   (crawl.js'ten sonra)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JWT } from 'google-auth-library';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..');
const veriYolu = path.join(KOK, 'data', 'data.json');
const cfg = JSON.parse(fs.readFileSync(path.join(KOK, 'sites.config.json'), 'utf8'));

// --- servis hesabi anahtari ---
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

// --- tarih araliklari (GSC ~3 gun gecikmeli) ---
const gun = (offset) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - offset); return d.toISOString().slice(0, 10); };
const BITIS = gun(3), BASLANGIC = gun(3 + 27);          // son 28 gun
const ONCEKI_BITIS = gun(3 + 28), ONCEKI_BASLANGIC = gun(3 + 55); // onceki 28 gun (trend icin)

// bir property adayina searchAnalytics sorgusu
async function saQuery(property, startDate, endDate) {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
  const res = await client.request({ url, method: 'POST', data: { startDate, endDate, dimensions: ['query'], rowLimit: 100 } });
  return res.data.rows || [];
}

// site icin dogru property formatini bul (sc-domain / url-prefix)
function adaylar(siteUrl) {
  const host = new URL(siteUrl).host.replace(/^www\./, '');
  return [
    `sc-domain:${host}`,
    `https://${host}/`, `https://www.${host}/`,
    `http://${host}/`, `http://www.${host}/`,
    siteUrl.replace(/\/?$/, '/'),
  ];
}

async function siteVerisi(site) {
  // Tum erisilebilir property adaylarini dene, VERISI EN COK olani sec (bos http:// varyantina takilmasin).
  let property = null, rows = null, erisilenVarBos = false;
  const hatalar = [];   // aday -> hata: hicbiri tutmazsa SEBEBI yazabilelim
  for (const aday of [...new Set(adaylar(site.url))]) {
    try {
      const r = await saQuery(aday, BASLANGIC, BITIS);
      erisilenVarBos = true;
      if (rows == null || r.length > rows.length) { rows = r; property = aday; }
      if (r.length > 0 && aday.startsWith('sc-domain:')) break; // domain property + veri = en iyisi
    } catch (e) {
      // 403/404 normal (o varyant yok). Ama kimlik/ag hatasini yutup "property yok"
      // demek yanlis teshise goturur -> hepsini sakla, asagida ozetle.
      const kod = e?.response?.status || e?.code || '?';
      hatalar.push(`${aday} → ${kod} ${String(e?.message || e).slice(0, 120)}`);
    }
  }
  if (property == null) return {
    hata: 'property bulunamadi (servis hesabi bu siteye ekli mi?)',
    detay: hatalar,
  };
  if (rows.length === 0) return { property, siralama: [], firsat: [], bos: true };

  // onceki donem (trend)
  let oncekiRows = [];
  try { oncekiRows = await saQuery(property, ONCEKI_BASLANGIC, ONCEKI_BITIS); } catch {}
  const oncekiPoz = new Map(oncekiRows.map(r => [r.keys[0], r.position]));

  // siralama: tika/gosterime gore en iyi 15
  const sirali = [...rows].sort((a, b) => (b.clicks - a.clicks) || (b.impressions - a.impressions));
  const siralama = sirali.slice(0, 15).map(r => ({
    kelime: r.keys[0],
    pozisyon: Math.round(r.position),
    onceki: oncekiPoz.has(r.keys[0]) ? Math.round(oncekiPoz.get(r.keys[0])) : Math.round(r.position),
    gosterim: r.impressions,
    tik: r.clicks,
  }));

  // firsat (icerik boslugu): 1. sayfa disinda ama gorunurluk var (pozisyon 8-50, gosterim >=8)
  // = bu kelimelerde cikiyorsun ama gerilerde; icerigi guclendirirsen ust siralara tasinir.
  const firsat = rows
    .filter(r => r.position >= 8 && r.position <= 50 && r.impressions >= 8)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10)
    .map(r => ({ kelime: r.keys[0], hacim: r.impressions, rakipPoz: Math.round(r.position), tip: 'firsat' }));

  return { property, siralama, firsat };
}

async function main() {
  const veri = JSON.parse(fs.readFileSync(veriYolu, 'utf8'));
  const aktif = (cfg.siteler || []).filter(s => s.aktif !== false && s.url);
  console.log(`🔎 Search Console: ${BASLANGIC} → ${BITIS} (servis hesabi: ${anahtar.client_email})`);

  let guncellenen = 0;
  for (const site of aktif) {
    process.stdout.write(`\n▶ ${site.ad} …`);
    const d = await siteVerisi(site);
    if (d.hata) {
      console.log(` ✕ ${d.hata}`);
      (d.detay || []).forEach(h => console.log(`     · ${h}`));
      continue;
    }
    if (d.bos) { console.log(` ⚠ property bagli ama VERI YOK: ${d.property} — dogru property'e (https/www veya domain) ekle`); continue; }
    const hedef = veri.siteler.find(s => s.id === site.id);
    if (!hedef) continue;

    hedef.siralama = d.siralama;
    hedef._siralamaGercek = true;
    hedef.icerikBoslugu = d.firsat;
    hedef._gapGercek = true;
    // Bu adim CI'da sessizce atlanabiliyor (|| echo). Damga olmazsa crawl.js eski blogu
    // "gercek veri" bayragiyla tasir ve panel bayat sayiyi taze gibi gosterir -> tarihi yaz.
    hedef.siralamaTarih = new Date().toISOString().slice(0, 10);
    hedef.siralamaPencere = { baslangic: BASLANGIC, bitis: BITIS };

    // NOT: indeks verisi burada DOLDURULMAZ. Sitemaps API'sindeki "indexed" alani kullanimdan
    // kalkti (hep 0 doner) -> yanlis sayi uretiyordu. Gercek indeks durumu URL Inspection API
    // ister (URL basina 1 istek, kotali): scripts/indeks.js.

    guncellenen++;
    console.log(` ✓ ${d.siralama.length} kelime, ${d.firsat.length} firsat [${d.property}]`);
  }

  veri.guncelleme = new Date().toISOString();
  fs.writeFileSync(veriYolu, JSON.stringify(veri, null, 2));
  fs.writeFileSync(path.join(KOK, 'assets', 'fallback-data.js'), 'window.SEO_FALLBACK = ' + JSON.stringify(veri) + ';\n');
  console.log(`\n${guncellenen ? '✅' : '✕'} Search Console: ${guncellenen}/${aktif.length} site guncellendi.`);
  // KRITIK: eskiden hicbir site guncellenmese bile 0 ile cikiliyordu. CI'daki
  // `|| echo "atlandi"` bile devreye girmiyordu -> is YESIL gorunurken siralama
  // verisi haftalarca donuyordu. Hicbir sey alinamadiysa bunu hata olarak bildir.
  if (!guncellenen) {
    console.error('\n✕ Hicbir siteden Search Console verisi alinamadi — siralama/icerik boslugu TAZELENMEDI.');
    console.error('  Kontrol: servis hesabi her GSC property\'sinde kullanici olarak ekli mi?');
    console.error(`  Servis hesabi: ${anahtar.client_email}`);
    process.exit(1);
  }
}

main().catch(e => { console.error('HATA:', e.message); process.exit(1); });
