// scripts/site-ekle.js
// sites.config.json'u elle duzenlemeden site ekle/sil/ac/kapat.
//
// Kullanim:
//   npm run site-ekle                                  -> soru-cevap (interaktif)
//   npm run site-ekle -- ornek.com                     -> ad/id otomatik uretilir
//   npm run site-ekle -- ornek.com "Ornek Site" tr,en  -> ad ve diller elle
//   npm run site-ekle -- --liste                       -> kayitli siteleri goster
//   npm run site-ekle -- --sil ornek                   -> siteyi sil
//   npm run site-ekle -- --pasif ornek                 -> taramadan cikar (aktif:false)
//   npm run site-ekle -- --aktif ornek                 -> tekrar taramaya al
//   ... --tara                                          -> ekledikten sonra hemen tarar

import readline from 'node:readline/promises';
import { stdin as girdi, stdout as cikti } from 'node:process';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ekle, sil, guncelle, liste, KOK } from './lib/siteler.js';

// --- arguman ayristirma: "--sil ornek" degerli, "--tara" degersiz ---
const DEGERLI = ['sil', 'pasif', 'aktif', 'id', 'not'];
const argv = process.argv.slice(2);
const bayraklar = {};
const serbest = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const ad = a.slice(2);
    bayraklar[ad] = DEGERLI.includes(ad) ? (argv[++i] ?? '') : true;
  } else serbest.push(a);
}
const bayrak = (ad) => bayraklar[ad] === true;
const bayrakDeger = (ad) => (typeof bayraklar[ad] === 'string' && bayraklar[ad] ? bayraklar[ad] : null);

const yesil = (s) => `\x1b[32m${s}\x1b[0m`;
const kirmizi = (s) => `\x1b[31m${s}\x1b[0m`;
const soluk = (s) => `\x1b[90m${s}\x1b[0m`;

function listeYaz() {
  const list = liste();
  if (!list.length) return console.log(soluk('Kayitli site yok.'));
  console.log(`\n${list.length} site:\n`);
  for (const s of list) {
    console.log(`  ${s.aktif ? yesil('●') : soluk('○')} ${s.id.padEnd(16)} ${String(s.ad).padEnd(24)} ${soluk(s.url)} ${soluk('[' + (s.diller || []).join(',') + ']')}`);
  }
  console.log('');
}

function taramayiCalistir() {
  console.log(soluk('\n→ Tarama basliyor (node scripts/crawl.js)...\n'));
  const r = spawnSync(process.execPath, [path.join(KOK, 'scripts/crawl.js')], { stdio: 'inherit', cwd: KOK });
  process.exit(r.status ?? 0);
}

function bitir(blok) {
  console.log(`\n${yesil('✓')} Eklendi: ${blok.ad} → ${blok.url}  ${soluk('(id: ' + blok.id + ', diller: ' + blok.diller.join(',') + ')')}`);
  if (bayrak('tara')) taramayiCalistir();
  else console.log(soluk('  Veriyi doldurmak icin: npm run tara-hepsi  (veya bu komuta --tara ekle)\n'));
}

try {
  if (bayrak('liste')) { listeYaz(); process.exit(0); }

  if (bayrakDeger('sil')) {
    const s = sil(bayrakDeger('sil'));
    console.log(`${yesil('✓')} Silindi: ${s.ad} (${s.id})`);
    process.exit(0);
  }
  if (bayrakDeger('pasif')) {
    const s = guncelle(bayrakDeger('pasif'), { aktif: false });
    console.log(`${yesil('✓')} Pasife alindi: ${s.ad} — artik taranmayacak.`);
    process.exit(0);
  }
  if (bayrakDeger('aktif')) {
    const s = guncelle(bayrakDeger('aktif'), { aktif: true });
    console.log(`${yesil('✓')} Aktif edildi: ${s.ad}`);
    process.exit(0);
  }

  // --- argumanli hizli ekleme ---
  if (serbest.length) {
    const [url, ad, diller] = serbest;
    bitir(ekle({ url, ad, diller, not: bayrakDeger('not'), id: bayrakDeger('id') }));
  } else {
    // --- interaktif ---
    const rl = readline.createInterface({ input: girdi, output: cikti });
    console.log('\nYeni site ekle ' + soluk('(bos birakilan alanlar otomatik doldurulur, iptal: Ctrl+C)\n'));
    const url = await rl.question('Site adresi   : ');
    const ad = await rl.question('Gorunen ad    ' + soluk('(bos = alan adindan)') + ': ');
    const diller = await rl.question('Diller        ' + soluk('(bos = tr)') + ': ');
    const not = await rl.question('Not           ' + soluk('(istege bagli)') + ': ');
    rl.close();
    bitir(ekle({ url, ad, diller, not }));
  }
} catch (e) {
  console.error(`\n${kirmizi('✕')} ${e.message}\n`);
  process.exit(1);
}
