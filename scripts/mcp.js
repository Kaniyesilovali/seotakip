#!/usr/bin/env node
// scripts/mcp.js
// MCP SUNUCUSU — panelin verisini AI ajanlarina (Claude Code, Codex, OpenClaw…) acar.
//
// Neden: data.json'da zaten her sey var ama ajan onu okuyabilmek icin dosya yolunu
// bilmek, 2 MB'lik JSON'u context'e sokmak ve alan adlarini tahmin etmek zorundaydi.
// Bu sunucu bunun yerine SORU BAZLI araclar verir: "hangi sitede kritik sorun var",
// "su siteyi neden 67 puan aldi", "bu hafta ne yapmaliyim".
//
// Bagimlilik YOK: MCP, stdio uzerinde satir basina bir JSON-RPC mesajidir; SDK gerektirmez.
//
// Claude Code'a ekleme:
//   claude mcp add seotakip -- node /Users/…/seotakip/scripts/mcp.js
// veya .mcp.json:
//   { "mcpServers": { "seotakip": { "command": "node", "args": ["scripts/mcp.js"] } } }

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import '../assets/sorun-katalogu.js';
import '../assets/oneri-motoru.js';
import '../assets/saglik-motoru.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..');
const SURUM = '0.1.0';

const veriOku = () => JSON.parse(fs.readFileSync(path.join(KOK, 'data', 'data.json'), 'utf8'));
const siteBul = (veri, id) => {
  if (!id) return null;
  const s = (veri.siteler || []).find(x => x.id === id || x.ad.toLowerCase() === String(id).toLowerCase());
  if (!s) throw new Error(`site bulunamadi: "${id}". Mevcut: ${(veri.siteler || []).map(x => x.id).join(', ')}`);
  return s;
};
const baglamYolu = (id) => path.join(KOK, 'data', 'baglam', `${id}.md`);

// ---- arac tanimlari ----
// Her aracin `calistir`'i duz metin dondurur; MCP icerigi metin blogu olarak tasir.
// Ajan icin JSON degil METIN donuyoruz: token'i az, okunmasi kolay, ozeti hazir.
const ARACLAR = [
  {
    name: 'siteler_listele',
    description: 'Takip edilen tum sitelerin ozeti: SEO puani, trend, taranan sayfa, acik sorun sayisi. Once bunu cagir.',
    inputSchema: { type: 'object', properties: {} },
    calistir() {
      const v = veriOku();
      const satir = (s) => {
        const sr = (s.sorunlar || []).map(b => ({ ...b, seviye: globalThis.sorunBilgi(b.tip).seviye }));
        const say = (sv) => sr.filter(b => b.seviye === sv).reduce((a, b) => a + b.adet, 0);
        return `${s.id.padEnd(16)} ${String(s.seo.puan).padStart(3)}/100 (${s.seo.trend})  ` +
          `${String(s.sayfalar?.taranan ?? 0).padStart(4)} sayfa  ` +
          `kritik ${say('kritik')} · uyari ${say('uyari')} · bilgi ${say('bilgi')}  ${s.url}`;
      };
      return `Guncelleme: ${v.guncelleme}\nOrtalama SEO puani: ${v.ozet?.ortalamaSeoPuan}/100\n\n` +
        (v.siteler || []).map(satir).join('\n') +
        `\n\nAyrinti icin: site_detay(site="<id>") · sorunlar(site="<id>") · oneriler(site="<id>")`;
    },
  },
  {
    name: 'sorunlar',
    description: 'Denetim bulgulari: her sorunun seviyesi, kac sayfayi etkiledigi, NEDEN onemli oldugu ve NASIL duzeltilecegi. Site ve seviyeye gore filtrelenir.',
    inputSchema: {
      type: 'object',
      properties: {
        site: { type: 'string', description: 'Site id (bos birakilirsa tum siteler)' },
        seviye: { type: 'string', enum: ['kritik', 'uyari', 'bilgi'], description: 'Yalnizca bu seviye' },
        ornekler: { type: 'boolean', description: 'Etkilenen ornek sayfa yollarini da yaz (varsayilan: true)' },
      },
    },
    calistir({ site, seviye, ornekler = true }) {
      const v = veriOku();
      const hedef = site ? [siteBul(v, site)] : (v.siteler || []);
      const parca = hedef.map(s => {
        let b = globalThis.sorunlariZenginlestir(s.sorunlar || []);
        if (seviye) b = b.filter(x => x.seviye === seviye);
        if (!b.length) return `## ${s.ad}\n(bu filtreye uyan bulgu yok)`;
        return `## ${s.ad} — ${s.url}  [SEO ${s.seo.puan}/100]\n` + b.map(x =>
          `\n### [${x.seviye.toUpperCase()}] ${x.baslik} — ${x.adet} kalem${x.puana ? '' : '  (puana girmiyor)'}\n` +
          `Neden: ${x.neden}\nNasil: ${x.nasil}` +
          (ornekler && x.ornekler?.length
            ? `\nOrnekler: ` + x.ornekler.slice(0, 6).map(o => o.deger ? `${o.yol} (${o.deger})` : o.yol).join(' · ')
            : '')
        ).join('\n');
      });
      return parca.join('\n\n') +
        `\n\nNot: "puana girmiyor" isaretli bulgular gercek sorunlardir ama SEO puani formulune dahil degildir ` +
        `(formul eski taramalarla karsilastirilabilir kalsin diye dondurulmustur).`;
    },
  },
  {
    name: 'oneriler',
    description: 'Onceliklendirilmis aksiyon listesi (kritik→dusuk), etki/efor skoru ve "hizli kazanim" isareti ile. Panelin ve haftalik raporun kullandigi ayni motor.',
    inputSchema: {
      type: 'object',
      properties: {
        site: { type: 'string', description: 'Site id (bos = tum portfoy)' },
        sadeceHizliKazanim: { type: 'boolean', description: 'Yalnizca yuksek etki + kolay efor maddeleri' },
        limit: { type: 'number', description: 'En fazla kac madde (varsayilan 25)' },
      },
    },
    calistir({ site, sadeceHizliKazanim = false, limit = 25 }) {
      const v = veriOku();
      const hedef = site ? [siteBul(v, site)] : (v.siteler || []);
      let o = globalThis.onerileriTopla(hedef);
      if (sadeceHizliKazanim) o = o.filter(x => x.hizliKazanim);
      if (!o.length) return 'Bu filtreye uyan oneri yok.';
      const govde = o.slice(0, limit).map((x, i) =>
        `${String(i + 1).padStart(2)}. [${x.oncelik}] (${x.site}) ${x.alan}: ${x.mesaj}` +
        `   — efor ${globalThis.EFOR_AD[x.efor]}, etki ${x.etki}/4${x.hizliKazanim ? ' ⚡hizli kazanim' : ''}`
      ).join('\n');
      return `${o.length} oneri (ilk ${Math.min(limit, o.length)} gosteriliyor)\n\n${govde}`;
    },
  },
  {
    name: 'site_detay',
    description: 'Tek sitenin tam durumu: puan, SSL, sitemap, robots/AI bot erisimi, schema, icerik, hiz, indeks, siralama.',
    inputSchema: { type: 'object', properties: { site: { type: 'string' } }, required: ['site'] },
    calistir({ site }) {
      const s = siteBul(veriOku(), site);
      const y = (e, d) => `${e.padEnd(22)} ${d}`;
      const rb = s.robots || {}, h = s.hiz || {}, i = s.indeks || {};
      return [
        `# ${s.ad} — ${s.url}`,
        y('SEO puani', `${s.seo.puan}/100 (onceki ${s.seo.onceki}, trend ${s.seo.trend})`),
        y('Durum', `${s.uptime?.durum} · anasayfa ${s.uptime?.yanitMs ?? '—'} ms · medyan ${s.uptime?.medyanMs ?? '—'} ms`),
        y('SSL', s.ssl?.gecerli ? `gecerli, ${s.ssl.kalanGun} gun (${s.ssl.bitis})` : 'gecersiz/erisilemez'),
        y('Sayfalar', `${s.sayfalar?.taranan} tarandi · ${s.sayfaDurum?.saglam} saglam · ${s.sayfaDurum?.sorunlu} sorunlu · ` +
          `${s.sayfaDurum?.kirik} kirik · ${s.sayfaDurum?.yonlendirme} yonlendirme · ${s.sayfaDurum?.engelli} engelli`),
        y('Sitemap', s.sitemap?.varMi ? `${s.sitemap.urlSayisi} URL (${(s.sitemap.dosyalar || []).length} dosya)` : 'YOK'),
        y('robots.txt', rb.varMi ? `${rb.kuralSayisi} kural · AI botu ${rb.toplamAi - rb.engelliAi}/${rb.toplamAi} serbest` : 'YOK'),
        y('llms.txt', s.llms?.varMi ? 'var' : 'YOK'),
        y('Schema', s.schema?.gecerli ? `gecerli — ${(s.schema.tipler || []).join(', ')}` : 'yok/gecersiz'),
        y('Icerik', `ort. ${s.icerik?.ortKelime} kelime · ${s.icerik?.inceSayfa} ince sayfa`),
        y('Ic link', `ort. ${s.iclink?.ortLink}/sayfa · ${(s.iclink?.orphan || []).length} oksuz`),
        y('Kirik link', `${s.kirikOzet?.ic} ic / ${s.kirikOzet?.dis} dis (+${s.kirikOzet?.dogrulanmamis} dogrulanmamis)`),
        y('Hiz', h.mobilPuan != null ? `mobil ${h.mobilPuan} · masaustu ${h.masaustuPuan} · LCP ${h.lcp}s · CLS ${h.cls} (${h.kaynak})` : 'olculmedi (npm run hiz)'),
        y('Lighthouse', h.erisilebilirlik != null
          ? `erisilebilirlik ${h.erisilebilirlik} · en iyi uygulama ${h.enIyiUygulama} · LH SEO ${h.lighthouseSeo}`
          : 'olculmedi (npm run hiz)'),
        y('Indeks', i.kontrolEdilen ? `${i.indeksli}/${i.kontrolEdilen} indeksli · ${i.aksiyonGereken ?? '—'} aksiyon gereken` : 'olculmedi (npm run indeks)'),
        y('Siralama', (s.siralama || []).length ? `${s.siralama.length} kelime (npm run gsc)` : 'olculmedi (npm run gsc)'),
        '', 'Sorunlar icin: sorunlar(site="' + s.id + '") · Puan kirilimi icin: saglik(site="' + s.id + '")',
      ].join('\n');
    },
  },
  {
    name: 'saglik',
    description: 'SEO puaninin tematik kirilimi: hangi kategori kac puan dusurdu (Taranabilirlik, On-page, Markup, Ic link, Icerik, Yanit, AI hazirligi) + puandan bagimsiz olcumler.',
    inputSchema: { type: 'object', properties: { site: { type: 'string' } }, required: ['site'] },
    calistir({ site }) {
      const s = siteBul(veriOku(), site);
      const g = globalThis.siteSaglik(s);
      const bol = (tip) => g.kategoriler.filter(k => k.tip === tip).map(k => {
        const bas = tip === 'puan'
          ? `## ${k.ad} — ${k.puan}/100 (ceza ${k.ceza}/${k.butce})`
          : `## ${k.ad} — ${k.puan == null ? 'olculmedi' : k.puan + '/100'}`;
        return bas + '\n' + k.kalemler.map(x =>
          `  ${x.ceza ? '✕' : x.bilgi ? '·' : '✓'} ${x.ad}: ${x.deger}${x.ceza ? ` (−${x.ceza})` : ''}`).join('\n');
      }).join('\n\n');
      return `# ${s.ad} saglik kirilimi\n\nSEO puani ${g.puan}/100 · kategori cezalari toplami ${g.ceza} → 100−${g.ceza}=${g.hesaplanan} ` +
        `${g.uyum ? '✓ crawl.js ile birebir tutuyor' : '⚠ MUTABAKAT TUTMUYOR — crawl.js ve saglik-motoru.js ayrismis'}\n\n` +
        `# Puani etkileyen kategoriler\n\n${bol('puan')}\n\n# Ayri olcumler (puana girmez)\n\n${bol('olcum')}`;
    },
  },
  {
    name: 'kelimeler',
    description: 'Search Console verisi: siralanan anahtar kelimeler ve firsat kelimeleri (2. sayfada olup yuksek gosterim alanlar).',
    inputSchema: { type: 'object', properties: { site: { type: 'string' } }, required: ['site'] },
    calistir({ site }) {
      const s = siteBul(veriOku(), site);
      const sr = s.siralama || [], gap = s.icerikBoslugu || [];
      if (!sr.length && !gap.length) return `${s.ad}: Search Console verisi yok. "npm run gsc" ile cek (kurulum README'de).`;
      // Olcum tarihi ve penceresi olmadan bu sayilar yanlis okunuyor: pozisyon 28 GUNLUK
      // ORTALAMA'dir, tek gunluk siralama degil. Bayatsa en uste uyari koy.
      const gun = s.siralamaTarih ? Math.floor((Date.now() - new Date(s.siralamaTarih).getTime()) / 86400000) : null;
      const pen = s.siralamaPencere ? `${s.siralamaPencere.baslangic} → ${s.siralamaPencere.bitis}` : 'bilinmiyor';
      const bayat = gun != null && gun > 4
        ? `\n\n⚠ BAYAT: bu veri ${gun} gundur yenilenmedi (son cekim ${s.siralamaTarih}). "npm run gsc" ile tazele.` : '';
      return `# ${s.ad} anahtar kelimeler\n\n` +
        `Son cekim: ${s.siralamaTarih || 'bilinmiyor'} · GSC penceresi: ${pen} (28 gunluk ORTALAMA)${bayat}\n\n` +
        `## Siralama (${sr.length})\n` +
        sr.map(k => `  #${String(k.pozisyon).padStart(3)} (onceki #${k.onceki ?? '—'})  ${k.kelime}  (gosterim ${k.gosterim ?? '—'}, tik ${k.tik ?? '—'})`).join('\n') +
        `\n\n## Firsat / icerik boslugu (${gap.length})\n` +
        gap.map(g => `  ~${g.hacim} gosterim · #${g.rakipPoz} · ${g.kelime}`).join('\n') +
        `\n\nNot: "hacim" gercek arama hacmi degil, Search Console GOSTERIM sayisidir.\n` +
        `Not: Az gosterimli kelimede pozisyon ortalamasi gurultuludur — tek bir dusuk gosterim\n` +
        `28 gunluk ortalamayi basamaklarca kaydirir. ~25 gosterimin altinda "dustu/cikti" yorumu yapma.`;
    },
  },
  {
    name: 'gecmis',
    description: 'Bir sitenin SEO puaninin tarih tarih seyri (data/history arsivinden).',
    inputSchema: {
      type: 'object',
      properties: { site: { type: 'string' }, gun: { type: 'number', description: 'Son kac gun (varsayilan 30)' } },
      required: ['site'],
    },
    calistir({ site, gun = 30 }) {
      const dizin = path.join(KOK, 'data', 'history');
      if (!fs.existsSync(dizin)) return 'Arsiv yok (data/history).';
      const esik = Date.now() - gun * 86400000;
      const dosyalar = fs.readdirSync(dizin).filter(f => f.endsWith('.json'))
        .filter(f => new Date(f.slice(0, 10)).getTime() >= esik).sort();
      const satirlar = dosyalar.map(f => {
        try {
          const v = JSON.parse(fs.readFileSync(path.join(dizin, f), 'utf8'));
          const s = (v.siteler || []).find(x => x.id === site);
          return s ? `  ${f.slice(0, 10)}  ${String(s.seo.puan).padStart(3)}/100  ${s.sayfalar?.taranan ?? '—'} sayfa` : null;
        } catch { return null; }
      }).filter(Boolean);
      return satirlar.length ? `# ${site} — son ${gun} gun\n\n${satirlar.join('\n')}` : `${site}: arsivde kayit yok.`;
    },
  },
  {
    name: 'baglam_oku',
    description: 'Bir sitenin PROJE HAFIZASI: ne is yaptigi, hedefi, konumlandirmasi, rakipleri, onemli sayfalari, yazim tercihleri. Site icin is yapmadan ONCE bunu oku.',
    inputSchema: { type: 'object', properties: { site: { type: 'string' } }, required: ['site'] },
    calistir({ site }) {
      const s = siteBul(veriOku(), site);
      const y = baglamYolu(s.id);
      if (!fs.existsSync(y)) return `${s.ad} icin henuz baglam yazilmamis.\nOlusturmak icin: baglam_yaz(site="${s.id}", icerik="…") veya "npm run baglam ${s.id}".`;
      return fs.readFileSync(y, 'utf8');
    },
  },
  {
    name: 'baglam_yaz',
    description: 'Site baglamini (proje hafizasi) yazar/gunceller. Kullanicidan ogrendigin kalici bilgileri buraya kaydet ki sonraki oturumlar tekrar sormasin.',
    inputSchema: {
      type: 'object',
      properties: {
        site: { type: 'string' },
        icerik: { type: 'string', description: 'Markdown govde. Dosyanin tamamini degistirir.' },
        ekle: { type: 'boolean', description: 'true ise mevcut icerigin sonuna ekler (varsayilan: false = degistirir)' },
      },
      required: ['site', 'icerik'],
    },
    calistir({ site, icerik, ekle = false }) {
      const s = siteBul(veriOku(), site);
      const y = baglamYolu(s.id);
      fs.mkdirSync(path.dirname(y), { recursive: true });
      const bas = `# ${s.ad} — proje baglami\n<!-- ${s.url} · son guncelleme: ${new Date().toISOString().slice(0, 10)} -->\n\n`;
      if (ekle && fs.existsSync(y)) fs.appendFileSync(y, `\n${icerik.trim()}\n`);
      else fs.writeFileSync(y, bas + icerik.trim() + '\n');
      return `✓ ${y} yazildi (${fs.statSync(y).size} bayt).`;
    },
  },
];

// ---- JSON-RPC / MCP dongusu ----
const yaz = (m) => process.stdout.write(JSON.stringify(m) + '\n');
const yanit = (id, result) => yaz({ jsonrpc: '2.0', id, result });
const hata = (id, kod, mesaj) => yaz({ jsonrpc: '2.0', id, error: { code: kod, message: mesaj } });

async function mesajIsle(m) {
  const { id, method, params } = m;
  if (method === 'initialize') {
    return yanit(id, {
      // Istemcinin istedigi surumu aynen kabul ediyoruz; bu sunucu tek bir
      // ozellik kullaniyor (tools) ve o tum MCP surumlerinde ayni.
      protocolVersion: params?.protocolVersion || '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'seotakip', version: SURUM },
      instructions: 'SEO/GEO takip panelinin verisi. Once siteler_listele ile durumu gor, ' +
        'sonra bir site icin sorunlar/oneriler/saglik cagir. Site icin icerik veya karar uretmeden once baglam_oku.',
    });
  }
  if (method === 'notifications/initialized' || method?.startsWith('notifications/')) return;
  if (method === 'ping') return yanit(id, {});
  if (method === 'tools/list') {
    return yanit(id, { tools: ARACLAR.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
  }
  if (method === 'tools/call') {
    const arac = ARACLAR.find(a => a.name === params?.name);
    if (!arac) return hata(id, -32602, `bilinmeyen arac: ${params?.name}`);
    try {
      const metin = await arac.calistir(params.arguments || {});
      return yanit(id, { content: [{ type: 'text', text: String(metin) }] });
    } catch (e) {
      // Arac hatasi protokol hatasi DEGIL: isError ile don ki ajan okuyup duzeltebilsin.
      return yanit(id, { content: [{ type: 'text', text: `HATA: ${e.message}` }], isError: true });
    }
  }
  if (id != null) hata(id, -32601, `desteklenmeyen method: ${method}`);
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (satir) => {
  const s = satir.trim(); if (!s) return;
  let m; try { m = JSON.parse(s); } catch { return hata(null, -32700, 'gecersiz JSON'); }
  Promise.resolve(mesajIsle(m)).catch(e => { if (m.id != null) hata(m.id, -32603, e.message); });
});
