// scripts/rapor.js
// Son tarama verisinden kendi kendine yeten TEK bir HTML rapor uretir.
// PDF icin ek paket YOK: rapor tarayicida acilir -> "PDF kaydet" dugmesi -> yazdir menusu.
// (Puppeteer/Chrome indirmek gerekmiyor; dist/ FTP ile yuklenince rapor sunucuda da acilir.)
//
// Kullanim:
//   node scripts/rapor.js                 -> haftalik, tum siteler
//   node scripts/rapor.js aylik           -> aylik (30 gun onceki anlik goruntuyle karsilastirir)
//   node scripts/rapor.js --site=animare  -> tek site
//
// Cikti: data/raporlar/2026-08-15-haftalik.html
//        + data/data.json icindeki "raporlar" listesi guncellenir (panel oradan linkler).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../assets/oneri-motoru.js'; // globalThis: oneriUret, onerileriTopla, haftalikOzet, EFOR_AD

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..');
const VERI_YOLU = path.join(KOK, 'data', 'data.json');
const GECMIS_KLASOR = path.join(KOK, 'data', 'history');
const RAPOR_KLASOR = path.join(KOK, 'data', 'raporlar');

// ---- argumanlar ----
const argv = process.argv.slice(2);
const TUR = argv.find(a => a === 'aylik') ? 'aylik' : 'haftalik';
const TEK_SITE = (argv.find(a => a.startsWith('--site=')) || '').split('=')[1] || '';
const GERI_GUN = TUR === 'aylik' ? 30 : 7;

// ---- veri ----
if (!fs.existsSync(VERI_YOLU)) { console.error('✕ data/data.json yok — once "npm run crawl" calistir.'); process.exit(1); }
const veri = JSON.parse(fs.readFileSync(VERI_YOLU, 'utf8'));
let siteler = veri.siteler || [];
if (TEK_SITE) {
  siteler = siteler.filter(s => s.id === TEK_SITE);
  if (!siteler.length) { console.error(`✕ site bulunamadi: ${TEK_SITE}`); process.exit(1); }
}

// ---- karsilastirma anlik goruntusu (data/history/YYYY-MM-DD.json) ----
// Hedef: bugunden GERI_GUN once. O tarihte dosya yoksa ona en yakin ESKI dosyayi al;
// hic eski dosya yoksa en eskisini al. Hic gecmis yoksa karsilastirma bolumu cikmaz.
function gecmisSnapshot() {
  if (!fs.existsSync(GECMIS_KLASOR)) return null;
  const dosyalar = fs.readdirSync(GECMIS_KLASOR).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  if (!dosyalar.length) return null;
  const bugun = (veri.guncelleme || new Date().toISOString()).slice(0, 10);
  const hedef = new Date(new Date(bugun + 'T00:00:00Z').getTime() - GERI_GUN * 86400000).toISOString().slice(0, 10);
  const adaylar = dosyalar.filter(f => f.slice(0, 10) <= hedef);
  const secilen = adaylar.length ? adaylar[adaylar.length - 1] : dosyalar[0];
  if (secilen.slice(0, 10) === bugun) return null; // sadece bugunun dosyasi varsa kiyas anlamsiz
  try {
    const j = JSON.parse(fs.readFileSync(path.join(GECMIS_KLASOR, secilen), 'utf8'));
    return { tarih: secilen.slice(0, 10), veri: j };
  } catch { return null; }
}
const gecmis = gecmisSnapshot();
const gecmisSite = (id) => (gecmis?.veri?.siteler || []).find(s => s.id === id) || null;

// ---- oneriler (panelin kullandigi motorun aynisi) ----
const oneriler = onerileriTopla(siteler);
const ortPuan = siteler.length ? Math.round(siteler.reduce((a, s) => a + (s.seo?.puan || 0), 0) / siteler.length) : 0;
const degisiklikler = (veri.degisiklikler || []).filter(d => !TEK_SITE || d.site === TEK_SITE);
const uyarilar = (veri.uyarilar || []).filter(u => !TEK_SITE || u.site === TEK_SITE);
const ozetMetni = haftalikOzet(siteler, oneriler, degisiklikler, ortPuan);

const kritik = oneriler.filter(o => o.oncelik === 'kritik');
const yuksek = oneriler.filter(o => o.oncelik === 'yuksek');
const hizliKazanimlar = oneriler.filter(o => o.hizliKazanim);

// ============ HTML yardimcilari ============
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const trTarih = (g) => { const [y, a, gn] = String(g).slice(0, 10).split('-'); const AY = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']; return `${+gn} ${AY[+a - 1]} ${y}`; };
const kisaUrl = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const ton = (p) => p >= 80 ? 'ok' : p >= 65 ? 'warn' : 'bad';
const delta = (simdi, once) => {
  if (once == null || simdi == null) return '<span class="d nul">—</span>';
  const f = simdi - once;
  if (!f) return '<span class="d nul">±0</span>';
  return `<span class="d ${f > 0 ? 'up' : 'down'}">${f > 0 ? '+' : ''}${f}</span>`;
};
const ONCELIK_AD = { kritik: 'KRİTİK', yuksek: 'YÜKSEK', orta: 'ORTA', dusuk: 'DÜŞÜK' };
const kirikSayi = (s) => s.kirikOzet?.ic ?? (s.kirikLinkler || []).length;

// ---- bolum: site skor tablosu ----
function skorTablosu() {
  const satir = (s) => {
    const g = gecmisSite(s.id);
    const sr = s.siralama || [];
    const ortPoz = sr.length ? (sr.reduce((a, k) => a + k.pozisyon, 0) / sr.length).toFixed(1) : null;
    return `<tr>
      <td class="ad"><b>${esc(s.ad)}</b><span>${esc(kisaUrl(s.url))}</span></td>
      <td class="say"><b class="${ton(s.seo?.puan)}">${s.seo?.puan ?? '—'}</b> ${gecmis ? delta(s.seo?.puan, g?.seo?.puan) : ''}</td>
      <td class="say">${s.sayfalar?.taranan ?? '—'}</td>
      <td class="say ${kirikSayi(s) ? 'bad' : 'ok'}">${kirikSayi(s)}</td>
      <td class="say">${s.indeks ? `${s.indeks.indeksli}/${s.indeks.kontrolEdilen}` : '—'}</td>
      <td class="say">${s.hiz?.mobilPuan ?? '—'}</td>
      <td class="say">${sr.length ? `${sr.length} kelime · ort. #${ortPoz}` : '—'}</td>
      <td class="say">${s.ssl?.gecerli ? `${s.ssl.kalanGun}g` : '<span class="bad">yok</span>'}</td>
    </tr>`;
  };
  return `<table class="tablo">
    <thead><tr><th>Site</th><th>SEO puanı</th><th>Sayfa</th><th>Kırık iç link</th><th>İndeks</th><th>Mobil hız</th><th>Sıralama</th><th>SSL</th></tr></thead>
    <tbody>${siteler.map(satir).join('')}</tbody>
  </table>`;
}

// ---- bolum: aksiyon listesi ----
function aksiyonListesi(liste, bosMetin) {
  if (!liste.length) return `<p class="bos">${esc(bosMetin)}</p>`;
  return `<ol class="aksiyon">${liste.map(o => `<li>
    <span class="rozet ${o.oncelik}">${ONCELIK_AD[o.oncelik]}</span>
    <span class="sit">${esc(o.site)}</span>
    <span class="msj">${esc(o.mesaj)}</span>
    <span class="efor">efor: ${EFOR_AD[o.efor]}</span>
  </li>`).join('')}</ol>`;
}

// ---- bolum: site detay ----
function siteDetay(s) {
  const g = gecmisSite(s.id);
  const kendi = oneriUret(s);
  const kritikSayi = kendi.filter(o => o.oncelik === 'kritik' || o.oncelik === 'yuksek').length;
  const geoMotor = (ad, v) => `<span class="geo ${v ? 'var' : 'yok'}">${ad}</span>`;
  const b = s.aiBotlar;
  const kutu = (etiket, deger, ek = '') => `<div class="kutu"><span>${esc(etiket)}</span><b>${deger}</b>${ek ? `<i>${ek}</i>` : ''}</div>`;
  return `<section class="site">
    <h3>${esc(s.ad)} <a href="${esc(s.url)}">${esc(kisaUrl(s.url))}</a></h3>
    <div class="kutular">
      ${kutu('SEO puanı', `<span class="${ton(s.seo?.puan)}">${s.seo?.puan ?? '—'}</span>`, gecmis && g ? `${gecmis.tarih}: ${g.seo?.puan ?? '—'}` : '')}
      ${kutu('Taranan sayfa', s.sayfalar?.taranan ?? '—', s.sayfalar ? `${s.sayfalar.noindex} noindex` : '')}
      ${kutu('Kırık iç link', kirikSayi(s))}
      ${kutu('İnce içerik', s.icerik?.inceSayfa ?? '—', s.icerik ? `< ${s.icerik.esik} kelime` : '')}
      ${kutu('Mobil hız', s.hiz?.mobilPuan ?? '—', s.hiz ? `LCP ${s.hiz.lcp}s · CLS ${s.hiz.cls}` : '')}
      ${kutu('İç link/sayfa', s.iclink?.ortLink ?? '—', s.iclink?.orphan?.length ? `${s.iclink.orphan.length} öksüz sayfa` : '')}
      ${kutu('İndeks', s.indeks ? `${s.indeks.indeksli}/${s.indeks.kontrolEdilen}` : '—', s.indeks ? `${s.indeks.aksiyonGereken} aksiyon gerekiyor` : 'Search Console bağlı değil')}
      ${kutu('SSL', s.ssl?.gecerli ? `${s.ssl.kalanGun} gün` : '<span class="bad">yok</span>', s.ssl?.bitis ? `bitiş ${s.ssl.bitis}` : '')}
    </div>
    <p class="satir"><b>GEO görünürlük:</b> ${s.geo
      ? [geoMotor('ChatGPT', s.geo.chatgpt), geoMotor('Perplexity', s.geo.perplexity), geoMotor('Gemini', s.geo.gemini), geoMotor('Claude', s.geo.claude)].join(' ')
      : '<span class="bos-i">ölçülmedi (npm run geo)</span>'}</p>
    <p class="satir"><b>AI bot ziyareti:</b> ${b
      ? `GPTBot ${b.gptbot || 0} · ClaudeBot ${b.claudebot || 0} · PerplexityBot ${b.perplexitybot || 0} · Google-Extended ${b.google || 0}`
      : '<span class="bos-i">log yüklenmedi (node scripts/botlog.js)</span>'}</p>
    ${(s.siralama || []).length ? `<p class="satir"><b>En iyi kelimeler:</b> ${(s.siralama || []).slice(0, 5).map(k => `${esc(k.kelime)} <b>#${k.pozisyon}</b>`).join(' · ')}</p>` : ''}
    <p class="satir"><b>Açık aksiyon:</b> ${kendi.length} madde${kritikSayi ? ` (${kritikSayi} tanesi kritik/yüksek)` : ''}</p>
    ${kendi.length ? `<ul class="mini">${kendi.slice(0, 6).map(o => `<li><span class="rozet ${o.oncelik}">${ONCELIK_AD[o.oncelik]}</span> ${esc(o.mesaj)}</li>`).join('')}</ul>` : ''}
  </section>`;
}

// ============ HTML ============
const bugun = (veri.guncelleme || new Date().toISOString()).slice(0, 10);
const baslik = TEK_SITE
  ? `${siteler[0].ad} — ${TUR === 'aylik' ? 'Aylık' : 'Haftalık'} SEO raporu`
  : `${TUR === 'aylik' ? 'Aylık' : 'Haftalık'} SEO / GEO raporu`;

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${esc(baslik)} — ${trTarih(bugun)}</title>
<style>
  /* Rapor ekranda da kagitta da ayni okunsun diye acik zeminli; panel temasindan bagimsiz. */
  :root { --mur:#1b1d22; --mut:#5c6270; --cizgi:#e3e5ea; --zemin:#fff; --ok:#1a7f43; --warn:#a1670a; --bad:#c02a45; }
  * { box-sizing:border-box; }
  body { margin:0; padding:36px 30px 60px; background:#f4f5f7; color:var(--mur);
         font:14px/1.6 "Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }
  .kagit { max-width:960px; margin:0 auto; background:var(--zemin); padding:44px 46px; border:1px solid var(--cizgi); }
  h1 { font-size:26px; margin:0 0 4px; letter-spacing:-.4px; }
  h2 { font-size:16px; margin:34px 0 12px; padding-bottom:7px; border-bottom:2px solid var(--mur); letter-spacing:.4px; text-transform:uppercase; }
  h3 { font-size:15px; margin:0 0 12px; }
  h3 a { font-weight:400; font-size:12.5px; color:var(--mut); text-decoration:none; margin-left:8px; }
  .ust { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; border-bottom:3px solid var(--mur); padding-bottom:14px; }
  .ust .meta { text-align:right; font-size:12px; color:var(--mut); line-height:1.7; }
  .ok{color:var(--ok)} .warn{color:var(--warn)} .bad{color:var(--bad)}
  .ozet { background:#f7f8fa; border-left:3px solid var(--mur); padding:14px 16px; margin:18px 0 0; font-size:13.5px; }
  .sayilar { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:18px 0 0; }
  .sayilar div { border:1px solid var(--cizgi); padding:11px 13px; }
  .sayilar span { display:block; font-size:10.5px; text-transform:uppercase; letter-spacing:.5px; color:var(--mut); }
  .sayilar b { font-size:24px; font-weight:600; }
  .tablo { width:100%; border-collapse:collapse; font-size:12.5px; }
  .tablo th { text-align:right; font-size:10.5px; text-transform:uppercase; letter-spacing:.4px; color:var(--mut);
              border-bottom:1px solid var(--mur); padding:6px 8px; white-space:nowrap; }
  .tablo th:first-child, .tablo td.ad { text-align:left; }
  .tablo td { padding:9px 8px; border-bottom:1px solid var(--cizgi); text-align:right; white-space:nowrap; }
  .tablo td.ad span { display:block; font-size:11px; color:var(--mut); font-weight:400; }
  .tablo td.say b { font-size:15px; }
  .d { font-size:11px; margin-left:3px; } .d.up{color:var(--ok)} .d.down{color:var(--bad)} .d.nul{color:var(--mut)}
  ol.aksiyon { margin:0; padding-left:22px; }
  ol.aksiyon li { margin-bottom:8px; padding-left:4px; }
  .rozet { display:inline-block; font-size:9.5px; font-weight:700; letter-spacing:.5px; padding:2px 6px; border:1px solid; margin-right:6px; vertical-align:1px; }
  .rozet.kritik{color:var(--bad);border-color:var(--bad)} .rozet.yuksek{color:var(--warn);border-color:var(--warn)}
  .rozet.orta{color:var(--mut);border-color:var(--cizgi)} .rozet.dusuk{color:var(--mut);border-color:var(--cizgi)}
  .sit { font-weight:600; margin-right:6px; }
  .efor { font-size:11px; color:var(--mut); margin-left:6px; }
  .site { border:1px solid var(--cizgi); padding:18px 20px; margin-bottom:14px; }
  .kutular { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:14px; }
  .kutu { border:1px solid var(--cizgi); padding:8px 10px; }
  .kutu span { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.4px; color:var(--mut); }
  .kutu b { font-size:18px; font-weight:600; } .kutu i { display:block; font-style:normal; font-size:10.5px; color:var(--mut); }
  .satir { margin:6px 0; font-size:12.5px; }
  .geo { display:inline-block; font-size:11px; padding:1px 7px; border:1px solid; margin-right:4px; }
  .geo.var { color:var(--ok); border-color:var(--ok); } .geo.yok { color:var(--mut); border-color:var(--cizgi); }
  ul.mini { margin:10px 0 0; padding-left:18px; font-size:12.5px; color:#3a3f4a; }
  ul.mini li { margin-bottom:4px; }
  ul.duz { margin:0; padding-left:18px; font-size:13px; }
  ul.duz li { margin-bottom:5px; }
  .bos, .bos-i { color:var(--mut); font-style:italic; }
  .dip { margin-top:34px; padding-top:12px; border-top:1px solid var(--cizgi); font-size:11px; color:var(--mut); }
  .yazdir { position:fixed; top:16px; right:16px; padding:10px 16px; font-size:13px; font-weight:600;
            background:var(--mur); color:#fff; border:0; cursor:pointer; }
  /* --- KAGIT --- */
  @page { size:A4; margin:14mm 12mm; }
  @media print {
    body { background:#fff; padding:0; font-size:11.5px; }
    .kagit { max-width:none; border:0; padding:0; }
    .yazdir { display:none; }
    h2 { margin-top:20px; }
    .site, ol.aksiyon li, .sayilar, .tablo tr { break-inside:avoid; page-break-inside:avoid; }
    h2 { break-after:avoid; page-break-after:avoid; }
    a { color:inherit; text-decoration:none; }
  }
</style>
</head>
<body>
<button class="yazdir" onclick="window.print()">PDF kaydet / Yazdır</button>
<div class="kagit">

  <div class="ust">
    <div>
      <h1>${esc(baslik)}</h1>
      <p style="margin:0;color:var(--mut);font-size:13px">${siteler.length} site · ${TUR === 'aylik' ? 'son 30 gün' : 'son 7 gün'}</p>
    </div>
    <div class="meta">
      Rapor tarihi: <b>${trTarih(bugun)}</b><br />
      ${gecmis ? `Karşılaştırma: ${trTarih(gecmis.tarih)}` : 'Karşılaştırma: geçmiş veri yok'}<br />
      SEO / GEO Nöbet Paneli
    </div>
  </div>

  <div class="ozet">${esc(ozetMetni)}</div>

  <div class="sayilar">
    <div><span>Ortalama SEO puanı</span><b class="${ton(ortPuan)}">${ortPuan}</b></div>
    <div><span>Kritik sorun</span><b class="${kritik.length ? 'bad' : 'ok'}">${kritik.length}</b></div>
    <div><span>Yüksek öncelikli</span><b class="${yuksek.length ? 'warn' : 'ok'}">${yuksek.length}</b></div>
    <div><span>Hızlı kazanım</span><b>${hizliKazanimlar.length}</b></div>
  </div>

  <h2>Site skorları</h2>
  ${skorTablosu()}

  <h2>Bu hafta yapılacaklar — kritik ve yüksek öncelik</h2>
  ${aksiyonListesi([...kritik, ...yuksek], 'Kritik veya yüksek öncelikli açık madde yok.')}

  <h2>Hızlı kazanımlar (yüksek etki, düşük efor)</h2>
  ${aksiyonListesi(hizliKazanimlar, 'Bu dönemde hızlı kazanım listesi boş.')}

  <h2>Son taramadaki değişiklikler</h2>
  ${degisiklikler.length
    ? `<ul class="duz">${degisiklikler.map(d => `<li><b>${esc(d.site)}</b> — ${esc(d.mesaj)} <span style="color:var(--mut)">(${esc(d.tarih)})</span></li>`).join('')}</ul>`
    : '<p class="bos">Son taramada kayda değer değişiklik yok.</p>'}

  <h2>Site detayları</h2>
  ${siteler.map(siteDetay).join('')}

  <h2>Açık uyarılar (${uyarilar.length})</h2>
  ${uyarilar.length
    ? `<ul class="duz">${uyarilar.map(u => `<li><span class="rozet ${u.seviye === 'acil' ? 'kritik' : u.seviye === 'uyari' ? 'yuksek' : 'orta'}">${esc(String(u.seviye).toUpperCase())}</span> <b>${esc(u.site)}</b> — ${esc(u.mesaj)}</li>`).join('')}</ul>`
    : '<p class="bos">Açık uyarı yok.</p>'}

  <p class="dip">
    Otomatik üretildi — <b>SEO / GEO Nöbet Paneli</b> · veri kaynağı: son tarama (${esc(veri.guncelleme || '—')}).<br />
    PDF için sağ üstteki “PDF kaydet” düğmesine bas, yazdırma penceresinde hedefi “PDF olarak kaydet” seç.
  </p>
</div>
</body>
</html>
`;

// ============ yaz ============
fs.mkdirSync(RAPOR_KLASOR, { recursive: true });
const dosyaAdi = `${bugun}-${TUR}${TEK_SITE ? '-' + TEK_SITE : ''}.html`;
const gorecelYol = `data/raporlar/${dosyaAdi}`;
fs.writeFileSync(path.join(RAPOR_KLASOR, dosyaAdi), html);

// data.json -> raporlar listesi (panel buradan linkler). Ayni dosya varsa uzerine yaz, yeniler basta.
const kayit = {
  ad: TEK_SITE ? `${siteler[0].ad} — ${TUR === 'aylik' ? 'aylık' : 'haftalık'} rapor` : `${TUR === 'aylik' ? 'Aylık' : 'Haftalık'} rapor — ${trTarih(bugun)}`,
  tarih: bugun,
  tur: TUR,
  dosya: gorecelYol,
};
// Rapor uretimi surerken arka planda tarama bitmis olabilir; dosyayi TEKRAR okuyup
// sadece "raporlar" alanini degistiriyoruz ki taze tarama sonuclari ezilmesin.
const guncel = JSON.parse(fs.readFileSync(VERI_YOLU, 'utf8'));
const mevcut = (guncel.raporlar || []).filter(r => r.dosya !== gorecelYol);
guncel.raporlar = [kayit, ...mevcut].slice(0, 24);
fs.writeFileSync(VERI_YOLU, JSON.stringify(guncel, null, 2) + '\n');
// panel file:// ile acildiginda data.json'u fetch edemez; diger scriptler gibi yedegi de guncelle
fs.writeFileSync(path.join(KOK, 'assets', 'fallback-data.js'), 'window.SEO_FALLBACK = ' + JSON.stringify(guncel) + ';\n');

console.log(`✓ rapor hazir: ${gorecelYol}`);
console.log(`   ${siteler.length} site · ${oneriler.length} oneri (${kritik.length} kritik, ${yuksek.length} yuksek)`);
console.log(gecmis ? `   karsilastirma: ${gecmis.tarih}` : '   karsilastirma: gecmis anlik goruntu yok (data/history bos)');
console.log(`\n→ Tarayicida ac: file://${path.join(RAPOR_KLASOR, dosyaAdi)}`);
console.log('→ PDF: raporu ac, sag ustteki "PDF kaydet" dugmesine bas.');
