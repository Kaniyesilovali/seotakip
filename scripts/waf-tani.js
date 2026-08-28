// scripts/waf-tani.js
// WAF TESHISI — "tarama engellendi" uyarisinin hangi halkada koptugunu bulur.
//
// Zincir su: crawl.js gizli basligi gonderir -> Cloudflare'daki Skip kurali
// bu basligi tanir -> istek challenge'a dusmeden gecer. Uc halkadan biri
// koparsa tarama 1 sayfada biter. Bu script her halkayi ayri ayri olcer:
//
//   1) Anahtar tanimli mi?            (.env veya SEOTAKIP_ANAHTAR ortam degiskeni)
//   2) Anahtarsiz istek engelleniyor mu?   (bu ag/IP challenge goruyor mu)
//   3) Anahtarli istek geciyor mu?         (Cloudflare kurali bu zone'da var mi)
//
// Onemli: 2. adim "hayir" ise bu makinenin IP'si zaten engellenmiyordur; kural
// dogru mu yanlis mi buradan ANLASILAMAZ. O yuzden testi engellenen ortamda
// (GitHub Actions runner'i) calistirmak gerekir — tarama.yml'e adim olarak eklenebilir.
//
// Calistir:  npm run waf-tani            (tum aktif siteler)
//            npm run waf-tani -- --site=animare

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { engelTespit } from './lib/engel-tespit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = process.env.SEOTAKIP_KOK ? path.resolve(process.env.SEOTAKIP_KOK) : path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(KOK, 'sites.config.json'), 'utf8'));
const UA = cfg.ayarlar?.kullaniciAjani ?? 'SeoTakipBot/1.0';
const ZAMANASIMI = cfg.ayarlar?.zamanAsimiMs ?? 15000;

function envDeger(k) {
  try {
    const e = fs.readFileSync(path.join(KOK, '.env'), 'utf8');
    const m = e.match(new RegExp('^\\s*' + k + '\\s*=\\s*(.+?)\\s*$', 'm'));
    return m ? m[1].replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
const ANAHTAR = process.env.SEOTAKIP_ANAHTAR || envDeger('SEOTAKIP_ANAHTAR');

async function dene(url, anahtarli) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ZAMANASIMI);
  const headers = { 'User-Agent': UA };
  if (anahtarli && ANAHTAR) headers['X-Seotakip-Anahtar'] = ANAHTAR;
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers });
    const govde = await r.text();
    const wafBaslik = { 'cf-mitigated': r.headers.get('cf-mitigated') || '', server: r.headers.get('server') || '' };
    const tespit = engelTespit({ status: r.status, basliklar: wafBaslik, govde });
    return { kod: r.status, boyut: govde.length, cfRay: r.headers.get('cf-ray') || '-',
      sunucu: wafBaslik.server || '-', mitigated: wafBaslik['cf-mitigated'] || '-', tespit };
  } catch (e) {
    return { kod: 0, boyut: 0, cfRay: '-', sunucu: '-', mitigated: '-', hata: e.name === 'AbortError' ? 'timeout' : e.message,
      tespit: { engel: false, kanit: [] } };
  } finally { clearTimeout(t); }
}

const isaret = (r) => (r.hata ? `✕ ${r.hata}` : r.tespit.engel ? `⛔ ENGEL (${r.tespit.saglayici})` : '✓ gecti');
const satir = (etiket, r) =>
  `      ${etiket.padEnd(12)} HTTP ${String(r.kod).padEnd(4)} ${String(r.boyut).padStart(7)} bayt  ` +
  `cf-ray=${r.cfRay.padEnd(22)} mitigated=${r.mitigated.padEnd(10)} ${isaret(r)}`;

async function main() {
  const argSite = (process.argv.find(a => a.startsWith('--site=')) || '').split('=')[1] || null;
  const siteler = (cfg.siteler || []).filter(s => s.aktif !== false && s.url && (!argSite || s.id === argSite));
  if (!siteler.length) { console.error(`✕ tarancak site yok${argSite ? ` (--site=${argSite})` : ''}`); process.exit(1); }

  console.log('\n═ WAF gecis teshisi ═\n');
  // Anahtarin KENDISI (parcasi dahil) hicbir yere yazilmaz — bu cikti CI loglarina
  // duser. Bunun yerine parmak izi: Cloudflare kuralindaki degeri ayni komutla
  // hash'leyip karsilastirabilirsin (README'de komut var).
  const izi = ANAHTAR ? crypto.createHash('sha256').update(ANAHTAR).digest('hex').slice(0, 12) : null;
  console.log(`  Gecis anahtari : ${ANAHTAR ? `TANIMLI (${ANAHTAR.length} karakter, sha256:${izi})` : 'TANIMSIZ'}`);
  console.log(`  User-Agent     : ${UA}`);
  console.log(`  Ortam          : ${process.env.GITHUB_ACTIONS ? 'GitHub Actions runner' : 'yerel makine'}`);
  if (!ANAHTAR) console.log('\n  ⚠ Anahtar yok — sadece "bu ag engelleniyor mu" olculebilir.');

  const sonuc = [];
  for (const site of siteler) {
    const kok = site.url.replace(/\/$/, '');
    console.log(`\n▶ ${site.ad}  (${kok})`);
    const yollar = [['anasayfa', kok + '/'], ['robots.txt', kok + '/robots.txt'], ['sitemap.xml', kok + '/sitemap.xml']];
    let anahtarsizEngel = false, anahtarliEngel = false;
    for (const [ad, url] of yollar) {
      console.log(`   ${ad}`);
      const acik = await dene(url, false);
      console.log(satir('anahtarsiz', acik));
      if (acik.tespit.engel) anahtarsizEngel = true;
      if (ANAHTAR) {
        const kapali = await dene(url, true);
        console.log(satir('anahtarli', kapali));
        if (kapali.tespit.engel) anahtarliEngel = true;
      }
    }
    // Karar tablosu
    let karar, seviye;
    if (!ANAHTAR) {
      karar = anahtarsizEngel
        ? 'Bu ag ENGELLENIYOR ve anahtar tanimsiz — SEOTAKIP_ANAHTAR ekle.'
        : 'Bu agdan engel yok; anahtar tanimsiz oldugu icin kural dogrulanamadi.';
      seviye = anahtarsizEngel ? 'HATA' : 'BELIRSIZ';
    } else if (anahtarliEngel) {
      karar = 'Anahtar GONDERILDI ama yine engellendi — bu zone\'da Cloudflare Skip kurali yok, ifade yanlis yazilmis ya da anahtar degeri eslesmiyor.';
      seviye = 'HATA';
    } else if (anahtarsizEngel) {
      karar = 'Kural CALISIYOR: anahtarsiz engelleniyor, anahtarli geciyor.';
      seviye = 'TAMAM';
    } else {
      karar = 'Bu IP hic engellenmiyor — kuralin dogrulugu buradan anlasilamaz. Testi engellenen ortamda (CI runner) calistir.';
      seviye = 'BELIRSIZ';
    }
    console.log(`   → [${seviye}] ${karar}`);
    sonuc.push({ id: site.id, ad: site.ad, seviye, karar });
  }

  console.log('\n═ Ozet ═');
  sonuc.forEach(s => console.log(`  ${s.seviye.padEnd(9)} ${s.ad}`));
  const hatali = sonuc.filter(s => s.seviye === 'HATA');
  if (hatali.length) {
    console.log(`\n⚠ ${hatali.length} sitede gecis zinciri kopuk. Kurulum adimlari: README "WAF gecis anahtari" bolumu.`);
    process.exit(2);
  }
  console.log('\n✅ Engellenen site yok.');
}

main().catch(e => { console.error('HATA:', e); process.exit(1); });
