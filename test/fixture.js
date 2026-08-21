// test/fixture.js
// KASTEN BOZUK TEST SITESI — her sayfa TEK bir SEO hatasi yapar.
//
// Fikir OpenSEO'nun badseo.dev'inden: crawler'i bilinen hatalarla dolu bir siteye
// dogrult, yakalamasi gerekenleri yakaliyor mu olc. Boylece crawl.js'teki bir
// puanlama/tespit degisikligi sessizce bir kontrolu bozamaz.
//
// Sayfalar bellekte durur (dosya degil): 404/500/403, yonlendirme zinciri/dongusu,
// X-Robots-Tag basligi ve yavas yanit gibi durumlar statik dosyayla uretilemez.
//
// SAYFA -> BEKLENEN BULGU eslesmesi BEKLENEN sabitinde; test/ucbasa.test.js
// her bulgunun en az bir sayfada tetiklendigini dogrular.

import http from 'node:http';

// Her sayfaya ozgu dolgu metni: ~120 kelime. Ayni metni her yere koyarsak
// yinelenen-icerik bulgusu her sayfada patlar; o yuzden yola gore degisiyor.
function dolgu(anahtar, tekrar = 8) {
  const c = `${anahtar} sayfasi teknik SEO denetimi icin uretilmis ornek bir govde metnidir ve ` +
    `bu cumle ${anahtar} icin yeterli kelime sayisini saglamak amaciyla tekrarlanir.`;
  return Array.from({ length: tekrar }, (_, i) => `<p>${c} Paragraf ${i + 1}.</p>`).join('\n');
}

// Menu: SADECE normal sayfalara link verir. Oksuz ve derin sayfalar buraya
// GIRMEZ, yoksa "oksuz-sayfa" ve "derin-sayfa" bulgulari hic olusmaz.
const MENU_YOLLAR = [
  '/', '/title-yok', '/title-uzun', '/title-kisa', '/description-yok', '/description-uzun',
  '/description-kisa', '/h1-yok', '/coklu-h1', '/baslik-atlama', '/ince-icerik', '/alt-yok',
  '/kopya-a', '/kopya-b', '/canonical-yok', '/canonical-cakisma', '/canonical-baska',
  '/noindex-meta', '/noindex-baslik', '/giden-link-yok', '/kirik-link-veren',
  '/zincir-1', '/dongu-a', '/yavas', '/schema-eksik', '/derin/1',
];
const menu = () => `<nav>${MENU_YOLLAR.map(y => `<a href="${y}">${y}</a>`).join(' ')}</nav>`;

// menusuz:true -> sayfada hic ic link olmaz (giden-link-yok ve derinlik zinciri icin sart)
function sayfa({ ad = 'ornek', title, desc, head = '', govde, menusuz = false }) {
  // Varsayilan title/desc her sayfada FARKLI olmali; ayni olsaydi yinelenen-title
  // bulgusu butun fixture'da patlar ve gercek kopya sayfalari (kopya-a/b) gizlerdi.
  if (title === undefined) title = `${ad} icin hazirlanmis ornek test sayfasi basligi`;
  if (desc === undefined) desc = `Bu sayfa (${ad}) teknik SEO denetimini test etmek icin hazirlanmis ornek bir aciklama metni tasir ve yeterli uzunluktadir.`;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">` +
    (title == null ? '' : `<title>${title}</title>`) +
    (desc == null ? '' : `<meta name="description" content="${desc}">`) +
    head + `</head><body>${menusuz ? '' : menu()}<main>${govde}</main></body></html>`;
}

const h1 = (t) => `<h1>${t}</h1>`;

// ---- sayfa tanimlari ----
// deger: string (HTML) veya { kod, basliklar, govde, gecikmeMs, konum }
export function sayfalar(kok) {
  const S = {};

  S['/'] = sayfa({ ad: 'anasayfa', title: 'Test sitesi anasayfasi ve genel tanitim', govde: h1('Anasayfa') + dolgu('anasayfa') +
    `<h2>Bolum</h2><h3>Alt bolum</h3><a href="/derin/1">derin zincir</a>` });

  // --- head etiketleri ---
  S['/title-yok'] = sayfa({ ad: 'title-yok', title: null, govde: h1('Title yok') + dolgu('title-yok') });
  S['/title-uzun'] = sayfa({ ad: 'title-uzun', title: 'Bu baslik kasten cok uzun tutulmustur ve arama sonuclarinda kesilecek kadar fazla karakter icerir', govde: h1('Uzun title') + dolgu('title-uzun') });
  S['/title-kisa'] = sayfa({ ad: 'title-kisa', title: 'Kisa', govde: h1('Kisa title') + dolgu('title-kisa') });
  S['/description-yok'] = sayfa({ ad: 'description-yok', desc: null, govde: h1('Description yok') + dolgu('description-yok') });
  S['/description-uzun'] = sayfa({ ad: 'description-uzun', desc: 'Bu meta aciklama kasten cok uzun yazilmistir '.repeat(6), govde: h1('Uzun description') + dolgu('description-uzun') });
  S['/description-kisa'] = sayfa({ ad: 'description-kisa', desc: 'Cok kisa ozet.', govde: h1('Kisa description') + dolgu('description-kisa') });

  // --- basliklar ---
  S['/h1-yok'] = sayfa({ ad: 'h1-yok', govde: '<h2>H1 olmadan baslayan sayfa</h2>' + dolgu('h1-yok') });
  S['/coklu-h1'] = sayfa({ ad: 'coklu-h1', govde: h1('Birinci') + h1('Ikinci') + h1('Ucuncu') + dolgu('coklu-h1') });
  S['/baslik-atlama'] = sayfa({ ad: 'baslik-atlama', govde: h1('Baslik') + '<h2>Ikinci seviye</h2><h4>Dorduncu seviyeye atladi</h4>' + dolgu('baslik-atlama') });

  // --- icerik ---
  S['/ince-icerik'] = sayfa({ ad: 'ince-icerik', govde: h1('Ince') + '<p>Bu sayfada yalnizca birkac kelime var.</p>' });
  S['/alt-yok'] = sayfa({ ad: 'alt-yok', govde: h1('Gorseller') +
    Array.from({ length: 12 }, (_, i) => `<img src="/g${i}.jpg">`).join('') + dolgu('alt-yok') });

  // --- yinelenenler: iki sayfa AYNI title + desc + govde ---
  const kopyaTitle = 'Tamamen ayni olan kopya sayfa basligi burada';
  const kopyaDesc = 'Bu iki sayfa ayni meta aciklamayi ve ayni govde metnini paylasir, yinelenen icerik testidir.';
  const kopyaGovde = h1('Kopya') + dolgu('kopya');
  S['/kopya-a'] = sayfa({ title: kopyaTitle, desc: kopyaDesc, govde: kopyaGovde });
  S['/kopya-b'] = sayfa({ title: kopyaTitle, desc: kopyaDesc, govde: kopyaGovde });

  // --- canonical / indekslenebilirlik ---
  S['/canonical-yok'] = sayfa({ ad: 'canonical-yok', govde: h1('Canonical yok') + dolgu('canonical-yok') });
  S['/canonical-cakisma'] = sayfa({ ad: 'canonical-cakisma',
    head: `<link rel="canonical" href="${kok}/canonical-cakisma"><link rel="canonical" href="${kok}/kopya-a">`,
    govde: h1('Iki canonical') + dolgu('canonical-cakisma') });
  S['/canonical-baska'] = sayfa({ ad: 'canonical-baska', head: `<link rel="canonical" href="${kok}/">`, govde: h1('Baskasina canonical') + dolgu('canonical-baska') });
  S['/noindex-meta'] = sayfa({ ad: 'noindex-meta', head: '<meta name="robots" content="noindex,follow">', govde: h1('Meta noindex') + dolgu('noindex-meta') });
  S['/noindex-baslik'] = { basliklar: { 'X-Robots-Tag': 'noindex' },
    govde: sayfa({ ad: 'noindex-baslik', govde: h1('Baslik ile noindex') + dolgu('noindex-baslik') }) };

  // --- linkler ---
  S['/giden-link-yok'] = sayfa({ ad: 'giden-link-yok', menusuz: true, govde: h1('Cikan link yok') + dolgu('giden-link-yok') });
  S['/kirik-link-veren'] = sayfa({ ad: 'kirik-link-veren', govde: h1('Kirik link') + '<a href="/yok-404">olmayan sayfa</a>' + dolgu('kirik-link-veren') });
  S['/oksuz'] = sayfa({ ad: 'oksuz', govde: h1('Oksuz sayfa') + '<a href="/">anasayfa</a>' + dolgu('oksuz') });

  // --- HTTP durumlari ---
  // Sitemap'te listelenen ama 404 donen URL: gercek sitelerde en sik gorulen hata.
  // (/yok-404 sitemap'te DEGIL, sadece kirik ic link hedefi -> sayfa olarak taranmaz.)
  S['/sitemapte-404'] = { kod: 404, govde: sayfa({ ad: 'sitemapte-404', govde: h1('Sitemap\'te duran olu URL') }) };
  S['/yok-404'] = { kod: 404, govde: sayfa({ ad: 'yok-404', govde: h1('Bulunamadi') + '<p>404</p>' }) };
  S['/sunucu-hatasi'] = { kod: 500, govde: sayfa({ ad: 'sunucu-hatasi', govde: h1('Sunucu hatasi') + '<p>500</p>' }) };
  S['/engellenen'] = { kod: 403, govde: '<html><body><h1>Just a moment...</h1><p>Checking your browser</p></body></html>' };

  // --- yonlendirmeler ---
  S['/zincir-1'] = { kod: 301, konum: '/zincir-2' };
  S['/zincir-2'] = { kod: 301, konum: '/zincir-3' };
  S['/zincir-3'] = sayfa({ ad: 'zincir-3', govde: h1('Zincir sonu') + dolgu('zincir-3') });
  S['/dongu-a'] = { kod: 302, konum: '/dongu-b' };
  S['/dongu-b'] = { kod: 302, konum: '/dongu-a' };

  // --- sondaki egik cizgi yonlendirmesi (REGRESYON KORUMASI) ---
  // /egik-cizgi -> 308 -> /egik-cizgi/ MESRU bir yonlendirmedir, dongu DEGILDIR.
  // Bir kez dongu sanilmis ve tum site "0 sayfa tarandi" ile bitmisti; bu sayfa onu bekliyor.
  S['/egik-cizgi'] = sayfa({ ad: 'egik-cizgi', govde: h1('Sondaki egik cizgi') + dolgu('egik-cizgi') });

  // --- yavas yanit ---
  S['/yavas'] = { gecikmeMs: 2300, govde: sayfa({ ad: 'yavas', govde: h1('Yavas sayfa') + dolgu('yavas') }) };

  // --- schema zorunlu alani eksik (BlogPosting: image + author yok) ---
  S['/schema-eksik'] = sayfa({ ad: 'schema-eksik',
    head: `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: 'Eksik alanli blog yazisi', datePublished: '2026-01-01',
    })}</script>`, govde: h1('Schema') + dolgu('schema-eksik') });

  // --- derinlik zinciri: her sayfa yalnizca bir sonrakine link verir (menu YOK) ---
  for (let i = 1; i <= 5; i++) {
    S[`/derin/${i}`] = sayfa({ ad: `derin-${i}`, menusuz: true, title: `Derinlik seviyesi ${i} icin test sayfasi`,
      govde: h1(`Derinlik ${i}`) + dolgu(`derin-${i}`) + (i < 5 ? `<a href="/derin/${i + 1}">ileri</a>` : '') });
  }

  return S;
}

// Sitemap TUM sayfalari listeler (oksuz ve derin dahil) -> crawler sitemap modunda calisir.
const SITEMAP_DISI = new Set(['/yok-404']);

// ---- beklenen bulgular: hangi bulgu tipi bu fixture'da tetiklenmeli ----
// Testin sozlesmesi bu. Yeni bir kontrol eklerken buraya da bir sayfa eklenmeli.
export const BEKLENEN = [
  'title-yok', 'title-uzun', 'title-kisa',
  'description-yok', 'description-uzun', 'description-kisa',
  'h1-yok', 'coklu-h1', 'baslik-atlama',
  'ince-icerik', 'alt-eksik',
  'yinelenen-title', 'yinelenen-description', 'yinelenen-icerik',
  'canonical-yok', 'canonical-cakismasi', 'canonical-baskasina',
  'noindex-sayfa', 'giden-link-yok', 'oksuz-sayfa', 'kirik-ic-link',
  'sayfa-hatasi', 'sunucu-hatasi', 'engellenen-sayfa',
  'yonlendirme-zinciri', 'yonlendirme-dongusu',
  'yavas-yanit', 'derin-sayfa', 'schema-alan-eksik', 'llms-yok',
];

// ---- sunucu ----
export function sunucuBaslat() {
  return new Promise((resolve) => {
    const sunucu = http.createServer(async (req, res) => {
      const kok = `http://${req.headers.host}`;
      const S = sayfalar(kok);
      const hamYol = new URL(req.url, kok).pathname;
      // Egik cizgisiz istegi egik cizgiliye yonlendir (gercek sitelerin cogu boyle davranir).
      // Asagidaki normalize ikisini ayni sayfaya esler; bu yuzden burada, normalize'den ONCE.
      if (hamYol === '/egik-cizgi') { res.writeHead(308, { location: '/egik-cizgi/' }); return res.end(); }
      const yol = hamYol.replace(/\/$/, '') || '/';

      if (yol === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        return res.end(`User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nSitemap: ${kok}/sitemap.xml\n`);
      }
      if (yol === '/sitemap.xml') {
        const urller = Object.keys(S).filter(y => !SITEMAP_DISI.has(y));
        res.writeHead(200, { 'content-type': 'application/xml' });
        return res.end(`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
          urller.map(y => `<url><loc>${kok}${y === '/' ? '/' : y}</loc></url>`).join('') + `</urlset>`);
      }
      if (yol === '/llms.txt') { res.writeHead(404); return res.end('yok'); }

      const s = S[yol];
      if (s === undefined) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('<html><body>404</body></html>'); }

      if (typeof s === 'string') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(s); }
      if (s.gecikmeMs) await new Promise(r => setTimeout(r, s.gecikmeMs));
      if (s.konum) { res.writeHead(s.kod, { location: s.konum }); return res.end(); }
      res.writeHead(s.kod || 200, { 'content-type': 'text/html; charset=utf-8', ...(s.basliklar || {}) });
      res.end(s.govde);
    });
    sunucu.listen(0, '127.0.0.1', () => {
      const { port } = sunucu.address();
      resolve({ sunucu, kok: `http://127.0.0.1:${port}`, kapat: () => new Promise(r => sunucu.close(r)) });
    });
  });
}
