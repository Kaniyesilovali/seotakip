// scripts/baglam.js
// PROJE HAFIZASI — site basina kalici baglam (data/baglam/<siteId>.md).
//
// Neden: panel teknik durumu olcuyor ama "bu site ne is yapiyor, hedefi ne,
// rakibi kim, hangi sayfa onemli, nasil bir dille yaziyoruz" hicbir yerde yazili
// degildi. Her yeni oturumda (ister sen, ister bir AI ajani) bunlar bastan
// soruluyordu. Artik tek dosyada duruyor ve MCP uzerinden ajanlar da okuyup yazabiliyor.
//
// Kullanim:
//   npm run baglam                 kayitli baglamlari listele
//   npm run baglam -- animare      o sitenin baglamini goster (yoksa sablonu olustur)
//   npm run baglam -- animare --duzenle   $EDITOR ile ac

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..');
const DIZIN = path.join(KOK, 'data', 'baglam');
const cfg = JSON.parse(fs.readFileSync(path.join(KOK, 'sites.config.json'), 'utf8'));

const yol = (id) => path.join(DIZIN, `${id}.md`);

// Bos dosya "doldur beni" demiyor; sorulari basliklarla soruyoruz ki hem sen hem
// ajan neyin beklendigini bilsin. Cevapsiz basliklar zararsiz: MCP'de de gorunur.
const sablon = (s) => `# ${s.ad} — proje baglami
<!-- ${s.url} · son guncelleme: ${new Date().toISOString().slice(0, 10)} -->

## Ne is yapiyor
(bir-iki cumle: hangi hizmet/urun, kime, nerede)

## Hedef kitle
(kim ariyor, hangi dilde, hangi sehir/bolge)

## Bu donemki hedef
(or. "randevu formu doldurma sayisini artirmak", "ingilizce sayfalarda gorunurluk")

## Konumlandirma / fark
(rakiplerden ayrisan yan; sitede one cikarilmasi gereken sey)

## Rakipler
- (alan adi — neden rakip)

## Onemli sayfalar
- (yol — neden onemli)

## Yazim tercihleri
(ton, kacinilan ifadeler, terminoloji, dil kullanimi)

## Notlar / gecmis kararlar
- (tarih — karar ve gerekcesi)
`;

const siteler = (cfg.siteler || []).filter(s => s.url);
const argv = process.argv.slice(2);
const duzenle = argv.includes('--duzenle');
const hedefId = argv.find(a => !a.startsWith('--'));

if (!hedefId) {
  console.log('Kayitli baglamlar:\n');
  for (const s of siteler) {
    const y = yol(s.id);
    const var_ = fs.existsSync(y);
    const boyut = var_ ? `${fs.statSync(y).size} bayt` : '—';
    console.log(`  ${var_ ? '✓' : '·'} ${s.id.padEnd(18)} ${boyut.padStart(10)}  ${var_ ? y.replace(KOK + '/', '') : 'yok'}`);
  }
  console.log('\nGoster/olustur:  npm run baglam -- <siteId>');
  console.log('Duzenle:         npm run baglam -- <siteId> --duzenle');
  process.exit(0);
}

const site = siteler.find(s => s.id === hedefId);
if (!site) {
  console.error(`✕ site bulunamadi: ${hedefId}\n  Mevcut: ${siteler.map(s => s.id).join(', ')}`);
  process.exit(1);
}

const y = yol(site.id);
if (!fs.existsSync(y)) {
  fs.mkdirSync(DIZIN, { recursive: true });
  fs.writeFileSync(y, sablon(site));
  console.log(`✓ sablon olusturuldu: ${y.replace(KOK + '/', '')}\n`);
}

if (duzenle) {
  const editor = process.env.EDITOR || process.env.VISUAL || 'nano';
  spawnSync(editor, [y], { stdio: 'inherit' });
  console.log(`✓ kaydedildi: ${y.replace(KOK + '/', '')}`);
} else {
  console.log(fs.readFileSync(y, 'utf8'));
}
