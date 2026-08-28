// test/birim.test.js — sorun-tespit.js ve sorun-katalogu.js birim testleri.
// Ag/dosya yok; saniyeler degil milisaniyeler surer.  Calistir: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESIK, metinParmakIzi, baslikAtlamasi, derinlikHesapla, yinelenenGruplar,
  durumSinifi, sayfaSorunlari, ayniAdres,
} from '../scripts/lib/sorun-tespit.js';
import '../assets/sorun-katalogu.js';
import { taramaDogrula, ESIKLER } from '../scripts/lib/tarama-dogrula.js';
import { engelTespit } from '../scripts/lib/engel-tespit.js';

// ---- parmak izi ----
test('metinParmakIzi: ayni metin ayni iz, farkli metin farkli iz', () => {
  assert.equal(metinParmakIzi('Merhaba  dunya'), metinParmakIzi('merhaba dunya'));
  assert.notEqual(metinParmakIzi('a b c'), metinParmakIzi('a b d'));
  assert.equal(metinParmakIzi('   '), null);
});

// ---- baslik hiyerarsisi ----
test('baslikAtlamasi: yalnizca asagi dogru atlama sorun', () => {
  assert.deepEqual(baslikAtlamasi([1, 2, 4]), { onceki: 2, sonraki: 4 });
  assert.equal(baslikAtlamasi([1, 2, 3]), null);
  assert.equal(baslikAtlamasi([1, 2, 3, 2]), null, 'yukari cikmak normaldir');
  assert.equal(baslikAtlamasi([2]), null, 'tek baslikta atlama olamaz');
  assert.deepEqual(baslikAtlamasi([1, 3]), { onceki: 1, sonraki: 3 });
});

// ---- derinlik ----
test('derinlikHesapla: kokten BFS, ulasilamayan sayfa haritaya girmez', () => {
  const s = new Map([
    ['http://x/', { icLink: ['http://x/a'] }],
    ['http://x/a', { icLink: ['http://x/b'] }],
    ['http://x/b', { icLink: [] }],
    ['http://x/oksuz', { icLink: [] }],
  ]);
  const d = derinlikHesapla('http://x/', s);
  assert.equal(d.get('http://x/'), 0);
  assert.equal(d.get('http://x/a'), 1);
  assert.equal(d.get('http://x/b'), 2);
  assert.equal(d.has('http://x/oksuz'), false, 'link almayan sayfa ulasilamaz kalir');
});

// ---- yinelenenler ----
test('yinelenenGruplar: tek basina duran degerler elenir', () => {
  const g = yinelenenGruplar([
    { yol: '/a', deger: 'ayni' }, { yol: '/b', deger: 'ayni' },
    { yol: '/c', deger: 'tek' }, { yol: '/d', deger: '' },
  ]);
  assert.equal(g.length, 1);
  assert.equal(g[0].adet, 2);
  assert.deepEqual(g[0].yollar, ['/a', '/b']);
});

// ---- durum sinifi ----
test('durumSinifi: 403/429 ve bot dogrulama "kirik" degil "engellenen"', () => {
  assert.equal(durumSinifi(403), 'engellenen');
  assert.equal(durumSinifi(429), 'engellenen');
  assert.equal(durumSinifi(503, 'Just a moment...'), 'engellenen');
  assert.equal(durumSinifi(500), 'sunucu-hatasi');
  assert.equal(durumSinifi(404), 'sayfa-hatasi');
  assert.equal(durumSinifi(200), null);
});

// ---- canonical karsilastirmasi ----
test('ayniAdres: www ve sondaki egik cizgi farki onemsiz', () => {
  assert.equal(ayniAdres('https://x.com/a/', 'https://www.x.com/a'), true);
  assert.equal(ayniAdres('https://x.com/a', 'https://x.com/b'), false);
});

// ---- sayfa bulgulari ----
const temizSayfa = {
  title: 'Yeterince uzun ve makul bir sayfa basligi burada',
  desc: 'Bu meta aciklama yetmis karakterin uzerinde, yuz altmis karakterin altinda kalacak sekilde yazilmistir.',
  h1: 1, baslikSeviyeleri: [1, 2, 3], icLink: ['http://x/a'], noindex: false,
  canonicalListe: ['http://x/s'], canonical: 'http://x/s', kendiUrl: 'http://x/s',
  sure: 300, derinlik: 2,
};
const tipler = (p) => sayfaSorunlari(p).map(([t]) => t);

test('sayfaSorunlari: temiz sayfa hic bulgu uretmez', () => {
  assert.deepEqual(tipler(temizSayfa), []);
});

test('sayfaSorunlari: title/description uzunluk esikleri', () => {
  assert.ok(tipler({ ...temizSayfa, title: 'x'.repeat(ESIK.titleMax + 1) }).includes('title-uzun'));
  assert.ok(tipler({ ...temizSayfa, title: 'x'.repeat(ESIK.titleMin - 1) }).includes('title-kisa'));
  assert.ok(tipler({ ...temizSayfa, desc: 'x'.repeat(ESIK.descMax + 1) }).includes('description-uzun'));
  assert.ok(tipler({ ...temizSayfa, desc: 'x'.repeat(ESIK.descMin - 1) }).includes('description-kisa'));
  assert.equal(tipler({ ...temizSayfa, title: '' }).includes('title-kisa'), false,
    'title HIC yoksa uzunluk bulgusu degil, title-yok bulgusu uretilir');
});

test('sayfaSorunlari: coklu H1 ve baslik atlamasi', () => {
  assert.ok(tipler({ ...temizSayfa, h1: 3 }).includes('coklu-h1'));
  assert.ok(tipler({ ...temizSayfa, baslikSeviyeleri: [1, 2, 4] }).includes('baslik-atlama'));
});

test('sayfaSorunlari: canonical celiskisi', () => {
  assert.ok(tipler({ ...temizSayfa, canonicalListe: ['http://x/a', 'http://x/b'] }).includes('canonical-cakismasi'));
  assert.ok(tipler({ ...temizSayfa, noindex: true }).includes('canonical-cakismasi'),
    'canonical + noindex birlikte celiskilidir');
  assert.ok(tipler({ ...temizSayfa, canonical: 'http://x/baska', canonicalListe: ['http://x/baska'] })
    .includes('canonical-baskasina'));
});

test('sayfaSorunlari: giden link, yavas yanit, derinlik', () => {
  assert.ok(tipler({ ...temizSayfa, icLink: [] }).includes('giden-link-yok'));
  assert.ok(tipler({ ...temizSayfa, sure: ESIK.yavasMs + 1 }).includes('yavas-yanit'));
  assert.ok(tipler({ ...temizSayfa, derinlik: ESIK.derinlik + 1 }).includes('derin-sayfa'));
  assert.equal(tipler({ ...temizSayfa, derinlik: ESIK.derinlik }).includes('derin-sayfa'), false);
});

// ---- katalog butunlugu ----
test('katalog: sorun-tespit.js\'in urettigi her tip katalogda tanimli', () => {
  const uretilen = new Set([
    'title-uzun', 'title-kisa', 'description-uzun', 'description-kisa', 'coklu-h1',
    'baslik-atlama', 'giden-link-yok', 'noindex-sayfa', 'canonical-cakismasi',
    'canonical-baskasina', 'yavas-yanit', 'derin-sayfa', 'yinelenen-title',
    'yinelenen-description', 'yinelenen-icerik', 'yonlendirme-dongusu',
    'yonlendirme-zinciri', 'engellenen-sayfa', 'sunucu-hatasi', 'sayfa-hatasi',
  ]);
  for (const t of uretilen) {
    assert.ok(globalThis.SORUN_KATALOG[t], `katalogda eksik tip: ${t}`);
  }
});

test('katalog: her kaydin seviye/baslik/neden/nasil alanlari dolu', () => {
  for (const [tip, k] of Object.entries(globalThis.SORUN_KATALOG)) {
    assert.ok(['kritik', 'uyari', 'bilgi'].includes(k.seviye), `${tip}: gecersiz seviye`);
    assert.ok(k.baslik && k.neden && k.nasil, `${tip}: bos metin alani`);
    assert.equal(typeof k.puana, 'boolean', `${tip}: puana bayragi yok`);
  }
});

test('sorunlariZenginlestir: seviyeye gore siralar, metinleri doldurur', () => {
  const z = globalThis.sorunlariZenginlestir([
    { tip: 'derin-sayfa', adet: 5 },
    { tip: 'title-yok', adet: 1 },
    { tip: 'h1-yok', adet: 2 },
  ]);
  assert.deepEqual(z.map(x => x.tip), ['title-yok', 'h1-yok', 'derin-sayfa']);
  assert.equal(z[0].seviye, 'kritik');
  assert.ok(z[0].nasil.length > 10, 'cozum metni katalogdan gelmeli');
});


// ---- tarama saglik kontrolu ----
// Saglikli bir tarama nasil gorunur (84 sayfalik gercek bir siteden kisaltilmis)
const saglikliTarama = {
  sayfalar: { taranan: 84 },
  sitemap: { varMi: true, urlSayisi: 84 },
  robots: { varMi: true },
  icerik: { ortKelime: 548 },
  iclink: { ortLink: 25.2 },
};
// 23 Agustos 2026'da Cloudflare challenge'i boyle bir sonuc uretti
const engellenmisTarama = {
  sayfalar: { taranan: 1 },
  sitemap: { varMi: true, urlSayisi: 0 },
  robots: { varMi: false },
  icerik: { ortKelime: 8 },
  iclink: { ortLink: 0 },
};

test('taramaDogrula: engellenen tarama (challenge sayfasi) reddedilir', () => {
  const r = taramaDogrula(engellenmisTarama, saglikliTarama);
  assert.equal(r.gecerli, false);
  const kodlar = r.neden.map(n => n.kod);
  assert.ok(kodlar.includes('sayfa-cokusu'));
  assert.ok(kodlar.includes('sitemap-bos'));
  assert.ok(kodlar.includes('robots-kayboldu'));
  assert.ok(kodlar.includes('icerik-bos'));
  assert.ok(kodlar.includes('link-kayboldu'));
});

test('taramaDogrula: ayni saglikli tarama tekrar gelirse kabul edilir', () => {
  const r = taramaDogrula(saglikliTarama, saglikliTarama);
  assert.equal(r.gecerli, true);
  assert.deepEqual(r.neden, []);
});

test('taramaDogrula: temel yoksa (ilk tarama) her sonuc kabul edilir', () => {
  const r = taramaDogrula(engellenmisTarama, {});
  assert.equal(r.gecerli, true, 'yeni eklenen site hic kaydedilemez hale gelmemeli');
  assert.equal(r.temelYok, true);
});

test('taramaDogrula: tek sinyal mesru degisiklik sayilir, veri reddedilmez', () => {
  // robots.txt gercekten silinmis olabilir — tek basina taramayi cope atmaz
  const r = taramaDogrula({ ...saglikliTarama, robots: { varMi: false } }, saglikliTarama);
  assert.equal(r.gecerli, true);
  assert.deepEqual(r.neden.map(n => n.kod), ['robots-kayboldu']);
});

test('taramaDogrula: iki sinyal birlikte gelirse reddedilir', () => {
  const r = taramaDogrula({ ...saglikliTarama, robots: { varMi: false }, icerik: { ortKelime: 5 } }, saglikliTarama);
  assert.equal(r.gecerli, false);
  assert.equal(r.neden.length, 2);
});

test('taramaDogrula: sayfa cokusu tek basina yeter', () => {
  // sadece sayfa sayisi coktu, digerleri "normal" gorunuyor
  const r = taramaDogrula({ ...saglikliTarama, sayfalar: { taranan: 1 } }, saglikliTarama);
  assert.equal(r.gecerli, false);
  assert.deepEqual(r.neden.map(n => n.kod), ['sayfa-cokusu']);
});

test('taramaDogrula: gercek buyume/kucuime yanlis alarm uretmez', () => {
  const buyudu = { ...saglikliTarama, sayfalar: { taranan: 120 }, sitemap: { varMi: true, urlSayisi: 120 } };
  assert.equal(taramaDogrula(buyudu, saglikliTarama).gecerli, true);
  // 84 -> 40: yarisi silinmis ama esik (%20) asilmadi
  const kuculdu = { ...saglikliTarama, sayfalar: { taranan: 40 }, sitemap: { varMi: true, urlSayisi: 40 } };
  assert.equal(taramaDogrula(kuculdu, saglikliTarama).gecerli, true);
});

test('taramaDogrula: onceki tarama da kucukse kiyas yapilmaz', () => {
  const kucukTemel = { ...saglikliTarama, sayfalar: { taranan: ESIKLER.temelSayfa - 1 } };
  assert.equal(taramaDogrula(engellenmisTarama, kucukTemel).temelYok, true);
});


// ---- engel (challenge) tespiti ----
const CHALLENGE_GOVDE = `<!DOCTYPE html><html><head><title>Just a moment...</title></head>
<body><div id="cf-wrapper"><script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1"></script>
<form id="challenge-form" action="/?__cf_chl_f_tk=abc"></form></div></body></html>`;

test('engelTespit: cf-mitigated basligi tek basina yeter', () => {
  const t = engelTespit({ status: 403, basliklar: { 'cf-mitigated': 'challenge', server: 'cloudflare' } });
  assert.equal(t.engel, true);
  assert.equal(t.saglayici, 'cloudflare');
  assert.match(t.kanit[0], /cf-mitigated/);
});

test('engelTespit: 200 donen interstitial sayfa da engeldir', () => {
  // Cloudflare "Just a moment" sayfasi HTTP 200 doner — koda bakmak yetmez.
  const t = engelTespit({ status: 200, basliklar: { server: 'cloudflare' }, govde: CHALLENGE_GOVDE });
  assert.equal(t.engel, true);
  assert.equal(t.saglayici, 'cloudflare');
});

test('engelTespit: gercek sayfa engel sayilmaz', () => {
  const govde = '<html><head><title>Animare Veteriner Klinigi</title></head><body>' +
    '<h1>Kibris veteriner</h1><p>' + 'icerik '.repeat(500) + '</p></body></html>';
  assert.equal(engelTespit({ status: 200, basliklar: { server: 'cloudflare' }, govde }).engel, false);
});

test('engelTespit: Cloudflare\'dan bahseden normal sayfa yanlis alarm vermez', () => {
  // Tek desen + supheli olmayan kod -> engel degil (en az iki desen aranir).
  const govde = '<html><body><h1>Blog</h1><p>Sitemizi Cloudflare uzerinden yayinliyoruz.</p></body></html>';
  assert.equal(engelTespit({ status: 200, basliklar: { server: 'cloudflare' }, govde }).engel, false);
});

test('engelTespit: govde okunamasa bile 403 + WAF sunucusu sinyaldir', () => {
  const t = engelTespit({ status: 403, basliklar: { server: 'cloudflare' }, govde: '' });
  assert.equal(t.engel, true);
  assert.match(t.kanit[0], /HTTP 403/);
});

test('engelTespit: saglikli 404 engel degildir', () => {
  assert.equal(engelTespit({ status: 404, basliklar: { server: 'cloudflare' }, govde: '<html>Sayfa bulunamadi</html>' }).engel, false);
});

test('engelTespit: Headers nesnesi de duz nesne de kabul edilir', () => {
  const h = new Headers({ 'cf-mitigated': 'challenge' });
  assert.equal(engelTespit({ status: 403, basliklar: h }).engel, true);
});
