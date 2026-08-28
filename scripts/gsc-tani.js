// scripts/gsc-tani.js
// SEARCH CONSOLE TESHISI — "siralama/indeks verisi bayatliyor" uyarisinin hangi
// halkada koptugunu bulur.
//
// Zincir su: GSC_KEY_JSON secret'i -> gsc-key.json'a yazilir -> JWT ile token
// alinir -> servis hesabinin ekli oldugu property'ler listelenir -> her site
// bir property'e eslenir. Dort halkadan biri koparsa searchconsole.js ve
// indeks.js AYNI ANDA duser; iki adim da "hata" der ama SEBEBI soylemez.
// Bu script sebebi soyler:
//
//   1) Anahtar var mi ve AYRISTIRILABILIYOR mu?  (base64/kirpilmis yapistirma)
//   2) Google kimligi kabul ediyor mu?           (silinmis anahtar, kapali API)
//   3) Hesap hangi property'lere ekli?           (hic ekli degil / yanlis proje)
//   4) Her site bir property'e esleniyor mu ve izin yetiyor mu?
//
// IZIN NOTU: searchAnalytics icin "Sinirli" (siteRestrictedUser) yeter, URL
// Inspection ICIN YETMEZ -> indeks.js sessizce bos doner. O yuzden izin
// seviyesi site basina ayri raporlanir.
//
// Bu script HICBIR SEY YAZMAZ, sadece okur — tarama verisine dokunmaz.
//
// Calistir:  npm run gsc-tani

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JWT } from 'google-auth-library';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = process.env.SEOTAKIP_KOK ? path.resolve(process.env.SEOTAKIP_KOK) : path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(KOK, 'sites.config.json'), 'utf8'));

function envDeger(k) {
  try {
    const e = fs.readFileSync(path.join(KOK, '.env'), 'utf8');
    const m = e.match(new RegExp('^\\s*' + k + '\\s*=\\s*(.+?)\\s*$', 'm'));
    return m ? m[1].replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
const KEY_FILE = process.env.GSC_KEY_FILE || envDeger('GSC_KEY_FILE') || path.join(KOK, 'gsc-key.json');

// searchconsole.js ile AYNI aday sirasi — teshis gercek davranisi yansitmali.
function adaylar(siteUrl) {
  const host = new URL(siteUrl).host.replace(/^www\./, '');
  return [...new Set([`sc-domain:${host}`, `https://${host}/`, `https://www.${host}/`, `http://${host}/`, `http://www.${host}/`, siteUrl.replace(/\/?$/, '/')])];
}

// ---- 1. halka: anahtar okunabiliyor mu ----
function anahtariOku() {
  if (!fs.existsSync(KEY_FILE)) {
    return { hata: `anahtar dosyasi yok: ${KEY_FILE}`,
      ipucu: process.env.GITHUB_ACTIONS
        ? 'GSC_KEY_JSON secret tanimsiz olabilir — workflow onu bu dosyaya yaziyor.'
        : 'Servis hesabi JSON\'unu proje kokune gsc-key.json olarak koy.' };
  }
  const ham = fs.readFileSync(KEY_FILE, 'utf8');
  if (!ham.trim()) return { hata: 'anahtar dosyasi BOS', ipucu: 'Secret bos yapistirilmis olabilir.' };
  let a;
  try { a = JSON.parse(ham); } catch (e) {
    // En sik hata: JSON yerine base64 ya da tirnak icine alinmis metin yapistirmak.
    const bas = ham.trim().slice(0, 1);
    const ipucu = /^[A-Za-z0-9+/=\s]+$/.test(ham.trim())
      ? 'Icerik base64 gorunuyor — secret\'a HAM JSON yapistirilmali, base64 degil.'
      : bas === '"' ? 'Icerik tirnakla basliyor — JSON tirnak icine alinmis, tirnaklari kaldir.'
      : 'Icerik gecerli JSON degil — dosyanin tamami kopyalanmamis olabilir.';
    return { hata: `JSON ayristirilamadi: ${e.message}`, ipucu, boyut: ham.length, ilkKarakter: bas };
  }
  const eksik = ['client_email', 'private_key', 'project_id'].filter(k => !a[k]);
  if (eksik.length) return { hata: `anahtarda eksik alan: ${eksik.join(', ')}`, ipucu: 'Bu bir servis hesabi anahtari degil (OAuth istemci JSON\'u olabilir).' };
  return { anahtar: a, boyut: ham.length };
}

async function main() {
  console.log('\n═ Search Console gecis teshisi ═\n');
  console.log(`  Ortam        : ${process.env.GITHUB_ACTIONS ? 'GitHub Actions runner' : 'yerel makine'}`);
  console.log(`  Anahtar yolu : ${KEY_FILE}`);

  const okuma = anahtariOku();
  if (okuma.hata) {
    console.log(`\n  → [HATA] 1. halka: ${okuma.hata}`);
    if (okuma.boyut != null) console.log(`     dosya ${okuma.boyut} bayt, ilk karakter: ${JSON.stringify(okuma.ilkKarakter)}`);
    console.log(`     ${okuma.ipucu}`);
    process.exit(2);
  }
  const a = okuma.anahtar;
  // Anahtarin KENDISI asla yazilmaz — bu cikti CI loglarina duser. client_email
  // ve project_id gizli degil, teshisin can alici bilgisi: yanlis servis hesabi
  // yuklendiginde tek bakista gorunur.
  const izi = crypto.createHash('sha256').update(a.private_key).digest('hex').slice(0, 12);
  console.log(`  ✓ 1. halka: anahtar ayristirildi (${okuma.boyut} bayt)`);
  console.log(`     servis hesabi : ${a.client_email}`);
  console.log(`     proje         : ${a.project_id}`);
  console.log(`     anahtar izi   : sha256:${izi}  (yereldekiyle ayni mi diye karsilastir)`);

  // ---- 2. halka: kimlik ----
  const client = new JWT({ email: a.client_email, key: a.private_key, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
  try {
    await client.authorize();
    console.log('  ✓ 2. halka: Google kimligi kabul etti');
  } catch (e) {
    const kod = e?.response?.status || '?';
    console.log(`\n  → [HATA] 2. halka: token alinamadi (${kod}) ${String(e?.message).slice(0, 200)}`);
    console.log('     Olasi sebep: anahtar Google Cloud\'da silinmis/devre disi, saat kaymasi, ya da servis hesabi kapatilmis.');
    process.exit(2);
  }

  // ---- 3. halka: erisilebilen property'ler ----
  let liste = [];
  try {
    const res = await client.request({ url: 'https://searchconsole.googleapis.com/webmasters/v3/sites' });
    liste = res.data.siteEntry || [];
  } catch (e) {
    const kod = e?.response?.status || '?';
    const mesaj = String(e?.response?.data?.error?.message || e?.message).slice(0, 200);
    console.log(`\n  → [HATA] 3. halka: property listesi alinamadi (${kod}) ${mesaj}`);
    if (kod === 403) console.log(`     Google Cloud'da "${a.project_id}" projesinde Search Console API etkin mi?`);
    process.exit(2);
  }
  console.log(`  ✓ 3. halka: hesabin erisebildigi ${liste.length} property:`);
  if (!liste.length) {
    console.log('     (hicbiri) — GSC → Ayarlar → Kullanicilar ve izinler → bu e-postayi ekle');
  }
  liste.forEach(e => console.log(`     ${e.permissionLevel.padEnd(20)} ${e.siteUrl}`));

  // ---- 4. halka: site → property eslesmesi ----
  console.log('\n═ Site eslesmesi ═');
  const siteler = (cfg.siteler || []).filter(s => s.aktif !== false && s.url);
  const sonuc = [];
  for (const site of siteler) {
    const bulunan = adaylar(site.url).map(ad => liste.find(e => e.siteUrl === ad)).find(Boolean);
    let seviye, karar;
    if (!bulunan) {
      seviye = 'HATA';
      karar = `hicbir property adayi eslesmedi — ${a.client_email} bu siteye ekli degil`;
    } else if (bulunan.permissionLevel === 'siteFullUser' || bulunan.permissionLevel === 'siteOwner') {
      seviye = 'TAMAM';
      karar = `${bulunan.siteUrl} (${bulunan.permissionLevel}) — siralama + indeks calisir`;
    } else {
      // "Sinirli" izin searchAnalytics'e yeter ama URL Inspection'a yetmez:
      // indeks.js bu sitede sessizce bos doner, sebebi burada gorunsun.
      seviye = 'KISMI';
      karar = `${bulunan.siteUrl} (${bulunan.permissionLevel}) — siralama calisir, INDEKS CALISMAZ; izni "Tam"a yukselt`;
    }
    console.log(`  ${seviye.padEnd(7)} ${site.ad.padEnd(22)} ${karar}`);
    sonuc.push({ ad: site.ad, seviye });
  }

  const hatali = sonuc.filter(s => s.seviye === 'HATA');
  const kismi = sonuc.filter(s => s.seviye === 'KISMI');
  console.log('');
  if (hatali.length) {
    console.log(`⚠ ${hatali.length}/${sonuc.length} site hicbir property'e eslesmiyor — bu sitelerde siralama ve indeks TAZELENMEZ.`);
    process.exit(2);
  }
  if (kismi.length) {
    console.log(`⚠ ${kismi.length} sitede izin "Sinirli" — indeks denetimi bos donecek.`);
    process.exit(2);
  }
  console.log(`✅ ${sonuc.length}/${sonuc.length} site hazir — Search Console zinciri saglam.`);
}

main().catch(e => { console.error('HATA:', e); process.exit(1); });
