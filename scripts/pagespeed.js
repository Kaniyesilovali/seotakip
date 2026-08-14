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

async function psi(url, strategy) {
  const u = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  u.searchParams.set('url', url);
  u.searchParams.set('strategy', strategy);
  u.searchParams.set('category', 'performance');
  if (KEY) u.searchParams.set('key', KEY);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const r = await fetch(u, { signal: ctrl.signal });
    if (!r.ok) return { hata: 'http ' + r.status };
    return await r.json();
  } catch (e) {
    return { hata: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally { clearTimeout(t); }
}

// alan (CrUX) verisi yoksa laboratuvar (lighthouse) verisine dus
function metrikCek(data) {
  const puan = Math.round((data?.lighthouseResult?.categories?.performance?.score ?? 0) * 100);
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

  return { puan, lcp, inp, cls, alanVerisi: !!data?.loadingExperience?.metrics };
}

async function main() {
  const veri = JSON.parse(fs.readFileSync(veriYolu, 'utf8'));
  const aktif = (cfg.siteler || []).filter(s => s.aktif !== false && s.url);
  console.log(KEY ? '🔑 API anahtari kullaniliyor.' : 'ℹ️  API anahtari yok (kotali). export PAGESPEED_KEY=... ile artirabilirsin.');

  for (const site of aktif) {
    process.stdout.write(`\n▶ ${site.ad} — PageSpeed olculuyor…`);
    const mob = await psi(site.url, 'mobile');
    await bekle(1200);
    const des = await psi(site.url, 'desktop');
    await bekle(1200);

    if (mob.hata && des.hata) { console.log(` ✕ atlandi (${mob.hata})`); continue; }
    const m = metrikCek(mob);
    const d = metrikCek(des);

    const hedef = veri.siteler.find(s => s.id === site.id);
    if (!hedef) continue;
    hedef.hiz = {
      mobilPuan: m.puan, masaustuPuan: d.puan,
      lcp: m.lcp, inp: m.inp, cls: m.cls,
      kaynak: m.alanVerisi ? 'alan (CrUX)' : 'lab',
    };
    hedef._hizGercek = true; // crawl.js bir sonraki taramada bu alani korusun
    console.log(` ✓ mobil ${m.puan} / masaustu ${d.puan} · LCP ${m.lcp}s · CLS ${m.cls} · ${hedef.hiz.kaynak}`);
  }

  // ozet puani yeniden hesaplama gerekmiyor (SEO puani ayri). Sadece yaz.
  veri.guncelleme = new Date().toISOString();
  fs.writeFileSync(veriYolu, JSON.stringify(veri, null, 2));
  fs.writeFileSync(path.join(KOK, 'assets', 'fallback-data.js'), 'window.SEO_FALLBACK = ' + JSON.stringify(veri) + ';\n');
  console.log('\n✅ Hiz verisi data.json\'a islendi.');
}

main().catch(e => { console.error('HATA:', e); process.exit(1); });
