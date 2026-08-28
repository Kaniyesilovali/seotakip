// scripts/pagespeed.js
// Google PageSpeed Insights API ile Core Web Vitals (LCP/INP/CLS) + mobil/masaustu puani ceker.
// Ucretsiz. API anahtari opsiyonel (kotayi artirir): export PAGESPEED_KEY=... veya .env'e koy.
// crawl.js'ten SONRA calistir. data.json'daki her sitenin "hiz" alanini gercek veriyle doldurur.
//
// Calistir:  node scripts/pagespeed.js   (veya: PAGESPEED_KEY=xxx node scripts/pagespeed.js)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..');
const veriYolu = path.join(KOK, 'data', 'data.json');
const cfg = JSON.parse(fs.readFileSync(path.join(KOK, 'sites.config.json'), 'utf8'));

// API anahtari: once ortam degiskeni, sonra proje kokundeki .env dosyasi (PAGESPEED_KEY=...)
function envAnahtar() {
  try {
    const env = fs.readFileSync(path.join(KOK, '.env'), 'utf8');
    const m = env.match(/^\s*PAGESPEED_KEY\s*=\s*(.+?)\s*$/m);
    return m ? m[1].replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
const KEY = process.env.PAGESPEED_KEY || envAnahtar();
const bekle = (ms) => new Promise(r => setTimeout(r, ms));

async function psiDene(url, strategy) {
  const u = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  u.searchParams.set('url', url);
  u.searchParams.set('strategy', strategy);
  // Ayni istekte dort kategoriyi birden isteriz — ek maliyet yok, ek istek yok.
  // Erisilebilirlik ve "best practices" Lighthouse'un ucretsiz verdigi ama panelde
  // hic gosterilmeyen olcumlerdi; SEO kategorisi de bizim kendi denetimimizi capraz dogrular.
  for (const k of ['performance', 'accessibility', 'best-practices', 'seo']) u.searchParams.append('category', k);
  if (KEY) u.searchParams.set('key', KEY);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const r = await fetch(u, { signal: ctrl.signal });
    if (!r.ok) {
      // Sebebi tasi: eskiden sadece "http 500" donuyordu, kota asimi ile gecici
      // sunucu hatasi ayirt edilemiyordu.
      const govde = await r.text().catch(() => '');
      let mesaj = '';
      try { mesaj = JSON.parse(govde)?.error?.message || ''; } catch { /* JSON degilse bos gec */ }
      return { hata: `http ${r.status}${mesaj ? ' — ' + mesaj.replace(/\s+/g, ' ').slice(0, 120) : ''}` };
    }
    const j = await r.json();
    // HTTP 200 ama Lighthouse'un KENDISI patlamis olabilir (ERRORED_DOCUMENT_REQUEST,
    // NO_FCP ...). Bu da bir olcum degil, hatadir — 200 gorup veri saymayalim.
    const rt = j?.lighthouseResult?.runtimeError?.code;
    if (rt && rt !== 'NO_ERROR') return { hata: `lighthouse ${rt}` };
    return j;
  } catch (e) {
    return { hata: e.name === 'AbortError' ? 'timeout (60sn)' : e.message };
  } finally { clearTimeout(t); }
}

// PSI ara sira gecici olarak duser (5xx, kota, Lighthouse ici hata) — site saglikli
// olsa bile. Olculen site tarafinda sorun yok: ilk bayt ~100ms, robots.txt acik.
// O yuzden tek deneme yetmez; bir kez daha soruyoruz.
async function psi(url, strategy) {
  let son;
  for (let deneme = 1; deneme <= 2; deneme++) {
    son = await psiDene(url, strategy);
    if (!son.hata) return son;
    if (deneme < 2) { process.stdout.write(` [${strategy}: ${son.hata} → yeniden deniyorum]`); await bekle(4000); }
  }
  return son;
}

// alan (CrUX) verisi yoksa laboratuvar (lighthouse) verisine dus
function metrikCek(data) {
  const kat = data?.lighthouseResult?.categories || {};
  const katPuan = (ad) => kat[ad]?.score == null ? null : Math.round(kat[ad].score * 100);
  // DIKKAT: burada eskiden "?? 0" vardi ve "olcum yok"u gecerli bir 0 puana
  // ceviriyordu. Panel 0'i gercek sanip "mobil hiz 0/100 — kritik" onerisi
  // uretiyordu. Veri yoksa null: tum tuketiciler (app.js, rapor.js, oneri-motoru,
  // saglik-motoru) zaten null'i "—" olarak gosterip hesap disi birakiyor.
  const puan = kat.performance?.score == null ? null : Math.round(kat.performance.score * 100);
  const alan = data?.loadingExperience?.metrics || {};
  const lab = data?.lighthouseResult?.audits || {};
  const labNum = (id) => lab[id]?.numericValue;

  const lcp = alan.LARGEST_CONTENTFUL_PAINT_MS?.percentile != null
    ? +(alan.LARGEST_CONTENTFUL_PAINT_MS.percentile / 1000).toFixed(1)
    : (labNum('largest-contentful-paint') != null ? +(labNum('largest-contentful-paint') / 1000).toFixed(1) : null);

  const inp = alan.INTERACTION_TO_NEXT_PAINT?.percentile != null
    ? Math.round(alan.INTERACTION_TO_NEXT_PAINT.percentile)
    : (labNum('total-blocking-time') != null ? Math.round(labNum('total-blocking-time')) : null); // lab: TBT yaklasik

  const cls = alan.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile != null
    ? +(alan.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100).toFixed(2)
    : (labNum('cumulative-layout-shift') != null ? +labNum('cumulative-layout-shift').toFixed(2) : null);

  return { puan, lcp, inp, cls,
    erisilebilirlik: katPuan('accessibility'),
    enIyiUygulama: katPuan('best-practices'),
    lighthouseSeo: katPuan('seo'),
    alanVerisi: !!data?.loadingExperience?.metrics };
}

async function main() {
  const veri = JSON.parse(fs.readFileSync(veriYolu, 'utf8'));
  const aktif = (cfg.siteler || []).filter(s => s.aktif !== false && s.url);
  console.log(KEY ? '🔑 API anahtari kullaniliyor.' : 'ℹ️  API anahtari yok (kotali). export PAGESPEED_KEY=... ile artirabilirsin.');
  const basarisiz = [];   // mobil olcumu alinamayan siteler -> sonda ozetlenir

  for (const site of aktif) {
    process.stdout.write(`\n▶ ${site.ad} — PageSpeed olculuyor…`);
    const mob = await psi(site.url, 'mobile');
    await bekle(1200);
    const des = await psi(site.url, 'desktop');
    await bekle(1200);

    const hedef = veri.siteler.find(s => s.id === site.id);
    if (!hedef) continue;
    const onceki = hedef.hiz || {};

    // KRITIK: atlama kosulu eskiden "mob.hata && des.hata" idi — yalnizca IKISI
    // BIRDEN duserse vazgeciyordu. Mobil dusup masaustu calistiginda hata nesnesi
    // normal veriymis gibi islenir, mobilPuan 0 olarak YAZILIR ve ustune
    // _hizGercek + bugunun tarihi damgalanirdi: panelde taze ve gercek gorunen,
    // aslinda hic yapilmamis bir olcum. Bayatlik uyarisi da bunu yakalayamazdi.
    // Mobil olcum esas (Google mobil-oncelikli indeksliyor): alinamadiysa hicbir
    // seyi ezmiyoruz, tarihi de tazelemiyoruz — eski deger eskiligiyle kaliyor.
    const m = mob.hata ? null : metrikCek(mob);
    if (!m || m.puan == null) {
      const sebep = mob.hata || 'performans puani bos dondu';
      console.log(` ✕ mobil olculemedi (${sebep})`);
      console.log(`     onceki deger korundu: ${onceki.mobilPuan ?? '—'}/100 (${hedef.hizTarih || 'tarihsiz'}) — uzerine 0 YAZILMADI`);
      basarisiz.push({ ad: site.ad, sebep });
      continue;
    }

    const d = des.hata ? null : metrikCek(des);
    const masaustu = d && d.puan != null ? d.puan : (onceki.masaustuPuan ?? null);
    if (masaustu !== (d && d.puan)) console.log(` ⚠ masaustu olculemedi (${des.hata || 'puan bos'}) — onceki deger korundu`);

    hedef.hiz = {
      mobilPuan: m.puan, masaustuPuan: masaustu,
      lcp: m.lcp, inp: m.inp, cls: m.cls,
      erisilebilirlik: m.erisilebilirlik, enIyiUygulama: m.enIyiUygulama, lighthouseSeo: m.lighthouseSeo,
      kaynak: m.alanVerisi ? 'alan (CrUX)' : 'lab',
    };
    hedef._hizGercek = true; // crawl.js bir sonraki taramada bu alani korusun
    hedef.hizTarih = new Date().toISOString().slice(0, 10); // olcum tarihi: bayat veriyi panelde isaretlemek icin
    console.log(` ✓ mobil ${m.puan} / masaustu ${masaustu ?? '—'} · LCP ${m.lcp}s · CLS ${m.cls} · ${hedef.hiz.kaynak}`);
    console.log(`     erisilebilirlik ${m.erisilebilirlik ?? '—'} · en iyi uygulama ${m.enIyiUygulama ?? '—'} · Lighthouse SEO ${m.lighthouseSeo ?? '—'}`);
  }

  // ozet puani yeniden hesaplama gerekmiyor (SEO puani ayri). Sadece yaz.
  veri.guncelleme = new Date().toISOString();
  fs.writeFileSync(veriYolu, JSON.stringify(veri, null, 2));
  fs.writeFileSync(path.join(KOK, 'assets', 'fallback-data.js'), 'window.SEO_FALLBACK = ' + JSON.stringify(veri) + ';\n');
  console.log('\n✅ Hiz verisi data.json\'a islendi.');

  // Sessizce gecmesin: eskiden bu durumda script 0 ile cikiyordu, is ozeti
  // "✅ PageSpeed: tazelendi" diyordu ve panelde sahte bir 0 duruyordu.
  if (basarisiz.length) {
    console.error(`\n⚠ ${basarisiz.length}/${aktif.length} sitede mobil olcum ALINAMADI — o sitelerin hiz verisi tazelenmedi (onceki deger ve tarihi korundu):`);
    basarisiz.forEach(b => console.error(`   · ${b.ad}: ${b.sebep}`));
    console.error('  PSI arizasi geciciyse bir sonraki tarama toparlar; surekliyse siteyi https://pagespeed.web.dev ile elle dogrula.');
    process.exitCode = 2;
  }
}

main().catch(e => { console.error('HATA:', e); process.exit(1); });
