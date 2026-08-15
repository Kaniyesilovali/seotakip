// scripts/telegram.js
// Son taramadaki KRITIK durumlari Telegram'dan bildirir. Bagimlilik yok (fetch yerlesik).
//
// KURULUM (5 dakika, ucretsiz):
//   1) Telegram'da @BotFather'a yaz -> /newbot -> bot adini ver -> sana bir TOKEN verir.
//   2) Kendi botunla sohbet ac ve bir mesaj yolla (bot once senden mesaj almadan yazamaz).
//   3) https://api.telegram.org/bot<TOKEN>/getUpdates adresini ac -> "chat":{"id":123456789} -> chat id.
//   4) .env'e ekle:  TELEGRAM_TOKEN=...   TELEGRAM_CHAT_ID=...
//
// Kullanim:
//   node scripts/telegram.js            -> sadece DEGISEN kritik durumlari yollar (spam yok)
//   node scripts/telegram.js --hepsi    -> o anki tum kritik/yuksek durumu yollar
//   node scripts/telegram.js --test     -> baglantiyi dener, tek satir test mesaji atar
//   node scripts/telegram.js --kuru     -> hicbir sey yollamaz, mesaji ekrana basar
//
// Not: gonderilenler data/uyari-durumu.json'da tutulur; ayni sorun her taramada
// tekrar tekrar bildirilmez, sadece YENI cikan ve COZULEN durumlar yazilir.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../assets/oneri-motoru.js'; // globalThis: onerileriTopla

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..');
const VERI_YOLU = path.join(KOK, 'data', 'data.json');
const DURUM_YOLU = path.join(KOK, 'data', 'uyari-durumu.json');

const argv = process.argv.slice(2);
const HEPSI = argv.includes('--hepsi');
const TEST = argv.includes('--test');
const KURU = argv.includes('--kuru');

// ---- ayar: once ortam degiskeni, sonra .env ----
function envDeger(k) {
  try {
    const e = fs.readFileSync(path.join(KOK, '.env'), 'utf8');
    const m = e.match(new RegExp('^\\s*' + k + '\\s*=\\s*(.+?)\\s*$', 'm'));
    return m ? m[1].replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
const TOKEN = process.env.TELEGRAM_TOKEN || envDeger('TELEGRAM_TOKEN');
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || envDeger('TELEGRAM_CHAT_ID');

if (!KURU && (!TOKEN || !CHAT_ID)) {
  console.error('✕ TELEGRAM_TOKEN / TELEGRAM_CHAT_ID yok. .env dosyasina ekle (kurulum: bu dosyanin basindaki not).');
  console.error('  Once denemek icin: node scripts/telegram.js --kuru');
  process.exit(1);
}

// ---- gonderim ----
async function yolla(metin) {
  if (KURU) { console.log('--- kuru calisma, gonderilmedi ---\n' + metin); return true; }
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: metin, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) { console.error('✕ Telegram hatasi:', j.description || r.status); return false; }
  return true;
}

if (TEST) {
  const ok = await yolla('✅ <b>SEO Nöbet Paneli</b>\nBağlantı çalışıyor — uyarılar buraya düşecek.');
  console.log(ok ? '✓ test mesaji gonderildi' : '✕ test basarisiz');
  process.exit(ok ? 0 : 1);
}

// ---- veri ----
if (!fs.existsSync(VERI_YOLU)) { console.error('✕ data/data.json yok — once "npm run crawl" calistir.'); process.exit(1); }
const veri = JSON.parse(fs.readFileSync(VERI_YOLU, 'utf8'));
const siteler = veri.siteler || [];

// ============ bildirilecek olaylar ============
// Her olayin sabit bir "anahtar"i var; ayni anahtar iki taramada da varsa TEKRAR yollanmaz.
const olaylar = [];
const ekle = (anahtar, agirlik, metin) => olaylar.push({ anahtar, agirlik, metin });

for (const s of siteler) {
  const ad = s.ad || s.id;
  // 1) site cokmus
  if (s.uptime && s.uptime.durum !== 'up')
    ekle(`down:${s.id}`, 'acil', `🔴 <b>${ad}</b> ERİŞİLEMİYOR (${s.uptime.durum})`);
  // 2) SSL
  if (s.ssl && !s.ssl.gecerli)
    ekle(`ssl-yok:${s.id}`, 'acil', `🔴 <b>${ad}</b> SSL geçersiz/yok — site "güvenli değil" gösteriyor`);
  else if (s.ssl && s.ssl.kalanGun <= 14)
    ekle(`ssl-${s.ssl.kalanGun <= 7 ? '7' : '14'}:${s.id}`, 'acil', `⚠️ <b>${ad}</b> SSL ${s.ssl.kalanGun} gün sonra doluyor`);
  // 3) SEO puani ciddi dusus
  const dusus = (s.seo?.onceki ?? 0) - (s.seo?.puan ?? 0);
  if (dusus >= 10)
    ekle(`puan-dusus:${s.id}:${s.seo.puan}`, 'onemli', `📉 <b>${ad}</b> SEO puanı ${s.seo.onceki} → ${s.seo.puan} (-${dusus})`);
  // 4) kirik IC link
  const kirikIc = s.kirikOzet?.ic ?? 0;
  if (kirikIc)
    ekle(`kirik-ic:${s.id}:${kirikIc}`, 'onemli', `🔗 <b>${ad}</b> ${kirikIc} kırık iç link — kendi sayfalarına 404 veriyor`);
  // 5) indeks dususu
  if (s.indeks?.dususVar)
    ekle(`indeks-dusus:${s.id}`, 'onemli', `📉 <b>${ad}</b> indekslenen sayfa sayısı düştü — Search Console'a bak`);
}

// 6) motorun ciakrdigi kritik oneriler (panelde gorunenin aynisi)
for (const o of onerileriTopla(siteler).filter(x => x.oncelik === 'kritik'))
  ekle(`oneri:${o.siteId}:${o.alan}`, 'acil', `❗ <b>${o.site}</b> ${o.mesaj}`);

// ---- durum karsilastirma (spam onleme) ----
const oncekiDurum = (() => { try { return JSON.parse(fs.readFileSync(DURUM_YOLU, 'utf8')); } catch { return { acik: [] }; } })();
const oncekiSet = new Set(oncekiDurum.acik || []);
const simdikiAnahtarlar = olaylar.map(o => o.anahtar);
const simdikiSet = new Set(simdikiAnahtarlar);

const yeniler = olaylar.filter(o => !oncekiSet.has(o.anahtar));
const cozulenler = [...oncekiSet].filter(a => !simdikiSet.has(a));

const gonderilecek = HEPSI ? olaylar : yeniler;

// ---- mesaj ----
const tarih = (veri.guncelleme || new Date().toISOString()).slice(0, 10);
let mesaj = '';
if (gonderilecek.length) {
  const acil = gonderilecek.filter(o => o.agirlik === 'acil');
  const onemli = gonderilecek.filter(o => o.agirlik !== 'acil');
  mesaj = `<b>SEO Nöbet — ${tarih}</b>\n${HEPSI ? 'Açık durum' : 'Yeni gelişmeler'}: ${gonderilecek.length} madde\n`;
  if (acil.length) mesaj += `\n<b>ACİL</b>\n` + acil.map(o => '• ' + o.metin).join('\n') + '\n';
  if (onemli.length) mesaj += `\n<b>ÖNEMLİ</b>\n` + onemli.map(o => '• ' + o.metin).join('\n') + '\n';
}
if (cozulenler.length && !HEPSI)
  mesaj += (mesaj ? '\n' : `<b>SEO Nöbet — ${tarih}</b>\n`) + `✅ Kapanan: ${cozulenler.length} madde\n`;

// ---- gonder + durumu kaydet ----
if (!mesaj) {
  console.log(`✓ bildirilecek yeni durum yok (${olaylar.length} acik madde, hepsi daha once bildirildi)`);
} else {
  const ok = await yolla(mesaj.trim());
  console.log(ok
    ? `✓ Telegram'a gonderildi — ${gonderilecek.length} yeni, ${cozulenler.length} kapanan`
    : '✕ gonderilemedi');
  if (!ok && !KURU) process.exit(1);
}

// Durum dosyasi SADECE basarili gonderimden sonra guncellenir; gonderim patlarsa
// bir sonraki calistirmada ayni uyarilar yeniden denenir (uyari kaybolmasin).
if (!KURU) fs.writeFileSync(DURUM_YOLU, JSON.stringify({ guncelleme: tarih, acik: simdikiAnahtarlar }, null, 2) + '\n');
