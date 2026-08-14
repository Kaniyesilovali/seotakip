// scripts/icerik-ekle.js
// Claude (skill) ile uretilen icerigi panele ekler. Gemini'siz, API'siz yol.
// Bir JSON dosyasi okur ve data.json manifestine + data/icerikler/*.md olarak kaydeder.
//
// JSON bicimi:
//   { "siteId":"animare", "kelime":"...", "baslik":"...", "metaAciklama":"...",
//     "govde":"markdown...", "faq":[{"soru":"...","cevap":"..."}] }
//
// Kullanim:  node scripts/icerik-ekle.js <icerik.json>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..');
const veriYolu = path.join(KOK, 'data', 'data.json');
const cfg = JSON.parse(fs.readFileSync(path.join(KOK, 'sites.config.json'), 'utf8'));

const slugla = (s) => s.toLowerCase()
  .replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0, 60);

const [girdiPath] = process.argv.slice(2);
if (!girdiPath) { console.error('Kullanim: node scripts/icerik-ekle.js <icerik.md | icerik.json>'); process.exit(1); }

// .md (frontmatter) veya .json kabul eder
function mdCoz(raw) {
  const fm = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fm) throw new Error('markdown frontmatter (--- ... ---) bulunamadi');
  const meta = {};
  fm[1].split('\n').forEach(l => { const m = l.match(/^(\w+)\s*:\s*(.*)$/); if (m) meta[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); });
  let body = fm[2].trim();
  const faq = [];
  const idx = body.search(/^##\s+(Sıkça Sorulan Sorular|SSS|FAQ|Sikca Sorulan Sorular)/im);
  if (idx >= 0) {
    const blok = body.slice(idx); body = body.slice(0, idx).trim();
    blok.split(/^###\s+/m).slice(1).forEach(p => {
      const satir = p.split('\n'); const soru = satir[0].trim(); const cevap = satir.slice(1).join('\n').trim();
      if (soru && cevap) faq.push({ soru, cevap });
    });
  }
  return { siteId: meta.siteId, kelime: meta.kelime, baslik: meta.baslik, metaAciklama: meta.metaAciklama, kaynak: meta.kaynak, govde: body, faq };
}

const raw = fs.readFileSync(girdiPath, 'utf8');
const c = girdiPath.endsWith('.md') ? mdCoz(raw) : JSON.parse(raw);
for (const alan of ['siteId', 'kelime', 'baslik', 'govde']) if (!c[alan]) { console.error(`✕ eksik alan: ${alan}`); process.exit(1); }

const site = (cfg.siteler || []).find(s => s.id === c.siteId);
if (!site) { console.error(`✕ site bulunamadi: ${c.siteId}`); process.exit(1); }

const veri = JSON.parse(fs.readFileSync(veriYolu, 'utf8'));
const slug = slugla(c.kelime);
const faq = c.faq || [];

// markdown dosyasi (kullanicinin sitesine yapistirmasi icin)
const md = `# ${c.baslik}\n\n> ${c.metaAciklama || ''}\n\n${c.govde}\n\n` +
  (faq.length ? `## Sikca Sorulan Sorular\n\n${faq.map(f => `**${f.soru}**\n\n${f.cevap}`).join('\n\n')}\n` : '');
const dizin = path.join(KOK, 'data', 'icerikler');
fs.mkdirSync(dizin, { recursive: true });
fs.writeFileSync(path.join(dizin, `${c.siteId}-${slug}.md`), md);

// panel manifesti
veri.uretilenIcerikler = (veri.uretilenIcerikler || []).filter(x => !(x.siteId === c.siteId && x.slug === slug));
veri.uretilenIcerikler.unshift({
  siteId: c.siteId, site: site.ad, kelime: c.kelime, baslik: c.baslik,
  metaAciklama: c.metaAciklama || '', slug, tarih: new Date().toISOString().slice(0, 10),
  kelimeSayisi: (c.govde || '').split(/\s+/).filter(Boolean).length, faqSayisi: faq.length,
  kaynak: c.kaynak || 'Claude (skill)',
  dosya: `data/icerikler/${c.siteId}-${slug}.md`, govde: c.govde, faq,
});

fs.writeFileSync(veriYolu, JSON.stringify(veri, null, 2));
fs.writeFileSync(path.join(KOK, 'assets', 'fallback-data.js'), 'window.SEO_FALLBACK = ' + JSON.stringify(veri) + ';\n');
console.log(`✓ "${c.baslik}" panele eklendi (${(c.govde||'').split(/\s+/).filter(Boolean).length} kelime) -> data/icerikler/${c.siteId}-${slug}.md`);
