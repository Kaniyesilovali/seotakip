// test/ucbasa.test.js — GERCEK crawler'i kasten bozuk fixture siteye dogrultur.
//
// Birim testler tespit fonksiyonlarini olcer; bu test crawl.js'in TAMAMINI olcer:
// HTTP, sitemap kesfi, ayristirma, toplama ve data.json yazimi dahil.
//
// Gercek data/data.json'a dokunmaz: SEOTAKIP_KOK ile gecici bir klasorde calisir.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { sunucuBaslat, BEKLENEN } from './fixture.js';
import '../assets/sorun-katalogu.js';

const calistir = promisify(execFile);
const PROJE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let fixture, gecici, veri, site;

before(async () => {
  fixture = await sunucuBaslat();
  gecici = fs.mkdtempSync(path.join(os.tmpdir(), 'seotakip-test-'));
  fs.writeFileSync(path.join(gecici, 'sites.config.json'), JSON.stringify({
    // istekAralikMs=0: test hizli kosmali. Gercek taramada 400 ms nezaket bekleme suresi var.
    ayarlar: { maxSayfa: 100, istekAralikMs: 0, zamanAsimiMs: 10000, kullaniciAjani: 'SeoTakipBot/1.0 (test)' },
    siteler: [{ id: 'fixture', ad: 'Bozuk Test Sitesi', url: fixture.kok, aktif: true, diller: ['tr'] }],
  }));
  await calistir('node', [path.join(PROJE, 'scripts', 'crawl.js')], {
    env: { ...process.env, SEOTAKIP_KOK: gecici }, timeout: 180000, maxBuffer: 32 * 1024 * 1024,
  });
  veri = JSON.parse(fs.readFileSync(path.join(gecici, 'data', 'data.json'), 'utf8'));
  site = veri.siteler[0];
}, { timeout: 180000 });

after(async () => {
  await fixture?.kapat();
  if (gecici) fs.rmSync(gecici, { recursive: true, force: true });
});

test('tarama calisti ve sayfalari buldu', () => {
  assert.equal(veri.siteler.length, 1);
  assert.ok(site.sayfalar.taranan >= 25, `beklenenden az sayfa tarandi: ${site.sayfalar.taranan}`);
  assert.ok(site.sitemap.varMi, 'robots.txt\'te bildirilen sitemap bulunmali');
});

// Fixture'in sozlesmesi: her bozuk sayfa turu en az bir bulgu uretmeli.
// Bir kontrol sessizce bozulursa bu test tam olarak hangi tipin kayboldugunu soyler.
test('fixture\'daki her bozukluk yakalandi', () => {
  const bulunan = new Set((site.sorunlar || []).map(b => b.tip));
  const eksik = BEKLENEN.filter(t => !bulunan.has(t));
  assert.deepEqual(eksik, [], `crawler su bulgulari kacirdi: ${eksik.join(', ')}`);
});

test('bulgular katalogla eslesiyor ve ornek tasiyor', () => {
  for (const b of site.sorunlar) {
    assert.ok(globalThis.SORUN_KATALOG[b.tip], `katalogda olmayan bulgu tipi: ${b.tip}`);
    assert.ok(b.adet > 0, `${b.tip}: adet sifir`);
  }
});

test('yinelenenler: kopya-a ve kopya-b esleti', () => {
  const bul = (t) => site.sorunlar.find(b => b.tip === t);
  assert.equal(bul('yinelenen-title').adet, 2);
  assert.equal(bul('yinelenen-description').adet, 2);
  assert.equal(bul('yinelenen-icerik').adet, 2);
});

test('yonlendirme: zincir ve dongu ayirt edildi', () => {
  const zincir = site.sorunlar.find(b => b.tip === 'yonlendirme-zinciri');
  const dongu = site.sorunlar.find(b => b.tip === 'yonlendirme-dongusu');
  assert.ok(zincir.ornekler.some(o => o.yol.includes('zincir-1')), 'zincir-1 iki adimda gitmeli');
  assert.ok(dongu.ornekler.some(o => /dongu-/.test(o.yol)), 'dongu-a/b sonsuz halkada');
});

test('403 "kirik sayfa" degil "engellenen" olarak siniflandi', () => {
  const eng = site.sorunlar.find(b => b.tip === 'engellenen-sayfa');
  assert.ok(eng.ornekler.some(o => o.yol.includes('engellenen')));
  const hata = site.sorunlar.find(b => b.tip === 'sayfa-hatasi');
  assert.equal(hata.ornekler.some(o => o.yol.includes('engellenen')), false,
    '403 sayfasi 4xx bulgusuna da dusmemeli');
});

test('derinlik: menu disi zincirin ucundaki sayfalar derin isaretlendi', () => {
  const derin = site.sorunlar.find(b => b.tip === 'derin-sayfa');
  assert.ok(derin.adet >= 2, `derin sayfa sayisi beklenenden az: ${derin.adet}`);
  assert.ok(derin.ornekler.some(o => o.yol.includes('/derin/5')));
});

test('X-Robots-Tag basligindaki noindex de yakalandi', () => {
  const nx = site.sorunlar.find(b => b.tip === 'noindex-sayfa');
  assert.ok(nx.ornekler.some(o => o.deger && o.deger.includes('X-Robots-Tag')),
    'meta etiketi olmadan, yalnizca HTTP basligiyla gelen noindex de gorulmeli');
});

test('robots.txt AI bot analizi calisti (GPTBot fixture\'da engelli)', () => {
  const gpt = (site.robots.botlar || []).find(b => /gptbot/i.test(b.id) || /GPTBot/i.test(b.ad));
  assert.ok(gpt, 'GPTBot bot listesinde olmali');
  assert.equal(gpt.izin, false, 'fixture robots.txt GPTBot\'u engelliyor');
  assert.ok(site.robots.engelliAi >= 1);
});

test('SEO puani hesaplandi ve saglik motoruyla mutabik', async () => {
  await import('../assets/saglik-motoru.js');
  const s = globalThis.siteSaglik(site);
  assert.equal(s.hesaplanan, site.seo.puan,
    `saglik-motoru.js ile crawl.js puanlamasi ayristi (${s.hesaplanan} vs ${site.seo.puan}) — ` +
    'crawl.js puanlama blogunu degistirdiysen saglik-motoru.js\'i de guncelle');
});

// REGRESYON: /egik-cizgi -> 308 -> /egik-cizgi/ MESRU yonlendirmedir.
// Dongu tespiti sondaki egik cizgiyi normalize ederse bu yonlendirme "dongu" gorunur
// ve site tamamen taranamaz hale gelir (gercekte olmustu: "0 sayfa, 60 yonlendirme").
test('sondaki egik cizgi yonlendirmesi dongu sayilmaz, sayfa normal taranir', () => {
  const dongu = site.sorunlar.find(b => b.tip === 'yonlendirme-dongusu');
  assert.equal((dongu?.ornekler || []).some(o => o.yol.includes('egik-cizgi')), false,
    'egik cizgi yonlendirmesi dongu olarak isaretlenmis');
  const zincir = site.sorunlar.find(b => b.tip === 'yonlendirme-zinciri');
  assert.equal((zincir?.ornekler || []).some(o => o.yol.includes('egik-cizgi')), false,
    'tek adimlik egik cizgi yonlendirmesi zincir de sayilmamali');
  assert.ok((site.sayfaYollari || []).some(y => y.includes('egik-cizgi')),
    'sayfa icerik olarak taranmis olmali');
});

// REGRESYON: 23 Agustos 2026'da Cloudflare, tarayiciyi challenge sayfasina dusurdu.
// crawl.js bunu gercek veri sanip 5 sitenin de iyi verisini ezdi; panel "Ortalama 0
// ic link/sayfa", "GA4 yok", "h1 yok" gibi hayali sorunlar gosterdi ve puanlar dustu.
// Artik saglik kontrolu bu sonucu reddedip onceki veriyi korumali.
test('WAF challenge sayfasi: bozuk tarama eski veriyi ezmez', async () => {
  fixture.challengeAc();
  await calistir('node', [path.join(PROJE, 'scripts', 'crawl.js')], {
    env: { ...process.env, SEOTAKIP_KOK: gecici }, timeout: 180000, maxBuffer: 32 * 1024 * 1024,
  });
  const sonra = JSON.parse(fs.readFileSync(path.join(gecici, 'data', 'data.json'), 'utf8'));
  const s2 = sonra.siteler[0];

  assert.ok(s2.taramaHatasi, 'engellenen tarama isaretlenmeli');
  assert.equal(s2.taramaHatasi.sayfa, 1, 'challenge sayfasinda 1 sayfa gorulebilir');
  assert.ok(s2.taramaHatasi.neden.some(n => n.kod === 'sayfa-cokusu'));

  // veri korunmus mu — panelin gosterdigi her sey eski haliyle durmali
  assert.equal(s2.sayfalar.taranan, site.sayfalar.taranan, 'sayfa sayisi korunmali');
  assert.equal(s2.seo.puan, site.seo.puan, 'puan guncellenmemeli');
  assert.equal(s2.iclink.ortLink, site.iclink.ortLink, 'ic link ortalamasi korunmali');
  assert.equal(s2.icerik.ortKelime, site.icerik.ortKelime, 'kelime ortalamasi korunmali');
  assert.deepEqual(s2.sorunlar, site.sorunlar, 'sorun listesi degismemeli');

  assert.ok((sonra.uyarilar || []).some(u => u.seviye === 'kritik' && /Tarama basarisiz/i.test(u.mesaj)),
    'kritik "tarama basarisiz" uyarisi uretilmeli');

  // oneri motoru da bayat veriyi gizlememeli
  await import('../assets/oneri-motoru.js');
  const oneriler = globalThis.oneriUret(s2);
  assert.ok(oneriler.some(o => o.alan === 'Tarama' && o.oncelik === 'kritik'),
    'panelde ilk sirada "tarama engellendi" onerisi cikmali');
});
