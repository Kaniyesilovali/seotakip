// scripts/aiblog.js
// AI ile SEO uyumlu blog/icerik uretir (Auto SEO Blog). Google Gemini — ucretsiz free tier.
//
// KURULUM: .env'e ekle ->  GEMINI_API_KEY=xxx   (https://aistudio.google.com/apikey — bedava)
//          istersen model:  GEMINI_MODEL=gemini-2.0-flash  (varsayilan)
//
// Kullanim:
//   node scripts/aiblog.js <siteId> "<anahtar kelime>"   -> tek icerik uret
//   node scripts/aiblog.js <siteId>                       -> o sitenin en iyi firsat kelimesi icin uret
//   node scripts/aiblog.js --firsatlar                    -> tum sitelerin ilk firsat kelimeleri icin uret
//   node scripts/aiblog.js                                -> uretilebilecek firsat kelimelerini listeler

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..');
const veriYolu = path.join(KOK, 'data', 'data.json');
const cfg = JSON.parse(fs.readFileSync(path.join(KOK, 'sites.config.json'), 'utf8'));

function envDeger(k) {
  try { const e = fs.readFileSync(path.join(KOK, '.env'), 'utf8'); const m = e.match(new RegExp('^\\s*' + k + '\\s*=\\s*(.+?)\\s*$', 'm')); return m ? m[1].replace(/^["']|["']$/g, '') : ''; } catch { return ''; }
}
const KEY = process.env.GEMINI_API_KEY || envDeger('GEMINI_API_KEY');
const MODEL = process.env.GEMINI_MODEL || envDeger('GEMINI_MODEL') || 'gemini-2.0-flash';
function anahtarSart() { if (!KEY) { console.error('✕ GEMINI_API_KEY yok. .env\'e ekle (https://aistudio.google.com/apikey — bedava).'); process.exit(1); } }

const slugla = (s) => s.toLowerCase()
  .replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0, 60);

async function uret(site, kelime, dil, sayfalar = []) {
  const icLinkNot = sayfalar.length
    ? `\nIC LINK: Govde icinde, ASAGIDAKI GERCEK sayfalardan uygun olanlara markdown link ver ([metin](/yol)). SADECE bu listedekileri kullan, URL uydurma:\n${sayfalar.slice(0, 40).map(p => '- ' + p).join('\n')}`
    : '';
  const prompt = `Sen uzman bir SEO icerik yazarisin. "${site.ad}" (${site.url}) sitesi icin, ${dil} dilinde,
"${kelime}" anahtar kelimesini hedefleyen SEO uyumlu bir blog yazisi uret.
Kurallar: dogal ve akici dil, anahtar kelimeyi basligda ve ilk paragrafta kullan, H2/H3 alt basliklar,
600-1000 kelime govde, spam yok, gercekci bilgi.${icLinkNot}
Yalnizca GECERLI JSON dondur, baska hicbir sey yazma:
{
  "baslik": "60 karakteri gecmeyen, anahtar kelimeli baslik",
  "metaAciklama": "155 karakteri gecmeyen meta description",
  "govde": "markdown formatinda tam yazi (## ve ### basliklarla)",
  "faq": [{"soru":"...","cevap":"..."}],
  "icBaglantiOnerileri": ["ilgili konu 1", "ilgili konu 2"]
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini http ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const metin = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!metin) throw new Error('Gemini bos yanit dondurdu');
  let obj; try { obj = JSON.parse(metin); } catch { throw new Error('Gemini gecersiz JSON dondurdu'); }
  return obj;
}

function firsatKelimeleri(veri) {
  const list = [];
  for (const s of veri.siteler || []) for (const g of s.icerikBoslugu || []) if (g.tip === 'firsat') list.push({ siteId: s.id, ad: s.ad, kelime: g.kelime, pozisyon: g.rakipPoz, hacim: g.hacim });
  return list;
}

async function tekUret(veri, siteId, kelime) {
  const site = (cfg.siteler || []).find(s => s.id === siteId);
  if (!site) { console.error(`✕ site bulunamadi: ${siteId}`); return; }
  const dil = site.diller?.[0] === 'en' ? 'Ingilizce' : 'Turkce';
  if (!kelime) {
    const f = firsatKelimeleri(veri).find(x => x.siteId === siteId);
    if (!f) { console.error(`✕ ${site.ad} icin firsat kelimesi yok. Kelimeyi elle ver: node scripts/aiblog.js ${siteId} "kelime"`); return; }
    kelime = f.kelime;
  }
  anahtarSart();
  const sayfalar = (veri.siteler.find(s => s.id === siteId) || {}).sayfaYollari || [];
  process.stdout.write(`\n▶ ${site.ad} — "${kelime}" icin icerik uretiliyor (${MODEL}${sayfalar.length ? ', ' + sayfalar.length + ' ic link adayi' : ''})…`);
  const c = await uret(site, kelime, dil, sayfalar);
  const slug = slugla(kelime);

  // markdown dosyasi (kullanicinin sitesine yapistirmasi icin)
  const md = `# ${c.baslik}\n\n> ${c.metaAciklama}\n\n${c.govde}\n\n## Sikca Sorulan Sorular\n\n` +
    (c.faq || []).map(f => `**${f.soru}**\n\n${f.cevap}`).join('\n\n');
  const dizin = path.join(KOK, 'data', 'icerikler');
  fs.mkdirSync(dizin, { recursive: true });
  fs.writeFileSync(path.join(dizin, `${siteId}-${slug}.md`), md);

  // panel manifesti (data.json)
  veri.uretilenIcerikler = veri.uretilenIcerikler || [];
  veri.uretilenIcerikler = veri.uretilenIcerikler.filter(x => !(x.siteId === siteId && x.slug === slug)); // ayni varsa guncelle
  veri.uretilenIcerikler.unshift({
    siteId, site: site.ad, kelime, baslik: c.baslik, metaAciklama: c.metaAciklama,
    slug, tarih: new Date().toISOString().slice(0, 10),
    kelimeSayisi: (c.govde || '').split(/\s+/).length, faqSayisi: (c.faq || []).length,
    dosya: `data/icerikler/${siteId}-${slug}.md`, govde: c.govde, faq: c.faq || [],
  });
  console.log(` ✓ "${c.baslik}" (${(c.govde||'').split(/\s+/).length} kelime) -> data/icerikler/${siteId}-${slug}.md`);
}

async function main() {
  const veri = JSON.parse(fs.readFileSync(veriYolu, 'utf8'));
  const [arg1, arg2] = process.argv.slice(2);

  if (!arg1) {
    const f = firsatKelimeleri(veri);
    console.log('Uretilebilecek firsat kelimeleri (Search Console verisinden):\n');
    if (!f.length) { console.log('  (yok — once npm run gsc calistir)'); return; }
    f.forEach(x => console.log(`  ${x.siteId.padEnd(16)} "${x.kelime}"  (#${x.pozisyon}, ${x.hacim} gosterim)`));
    console.log('\nUretmek icin:  node scripts/aiblog.js <siteId> "<kelime>"');
    return;
  }

  if (arg1 === '--firsatlar') {
    const gruplar = {};
    firsatKelimeleri(veri).forEach(x => { if (!gruplar[x.siteId]) gruplar[x.siteId] = x; }); // site basina ilk firsat
    for (const x of Object.values(gruplar)) { try { await tekUret(veri, x.siteId, x.kelime); } catch (e) { console.error(` ✕ ${e.message}`); } }
  } else {
    try { await tekUret(veri, arg1, arg2); } catch (e) { console.error(` ✕ ${e.message}`); process.exit(1); }
  }

  fs.writeFileSync(veriYolu, JSON.stringify(veri, null, 2));
  fs.writeFileSync(path.join(KOK, 'assets', 'fallback-data.js'), 'window.SEO_FALLBACK = ' + JSON.stringify(veri) + ';\n');
  console.log('\n✅ Icerik(ler) data.json\'a islendi — panelde "AI Icerik / Blog" bolumunde gorunur.');
}

main().catch(e => { console.error('HATA:', e.message); process.exit(1); });
