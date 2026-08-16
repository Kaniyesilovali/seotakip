// scripts/lib/robots.js
// robots.txt ayristirici + yol eslestirici.
//
// Neden kendi ayristiricimiz: paneldeki en degerli soru "AI motorlari bu siteyi
// tarayabiliyor mu". Bunun cevabi robots.txt govdesinde; crawl.js eskiden sadece
// dosyanin VAR olup olmadigina bakiyordu.
//
// Kurallar Google'in robots.txt spesifikasyonunu takip eder:
//   - Ayni user-agent'a ait gruplar BIRLESTIRILIR (Cloudflare managed bloklarda
//     dosyada iki tane "User-agent: *" grubu olabiliyor).
//   - Eslestirmede EN UZUN kural kazanir; esitlikte Allow, Disallow'u yener.
//   - `*` joker, `$` satir sonu demek.
//   - Bos "Disallow:" = her seye izin.
// Bilinmeyen direktifler (ornegin Cloudflare'in Content-Signal'i) hata sayilmaz,
// ayrica dondurulur.

const YON_DIREKTIF = new Set(['allow', 'disallow']);
const BILINEN = new Set(['user-agent', 'allow', 'disallow', 'sitemap', 'crawl-delay', 'host', 'clean-param', 'noindex']);

// Panelde takip edilen AI/arama botlari. `ai:false` olanlar klasik arama botu —
// karsilastirma icin duruyor (AI botu engellenmis ama Googlebot serbest mi?).
export const AI_BOTLAR = [
  { id: 'gptbot',        ad: 'GPTBot',            sirket: 'OpenAI',    ai: true,  not: 'model egitimi' },
  { id: 'oai-searchbot', ad: 'OAI-SearchBot',     sirket: 'OpenAI',    ai: true,  not: 'ChatGPT arama indeksi' },
  { id: 'chatgpt-user',  ad: 'ChatGPT-User',      sirket: 'OpenAI',    ai: true,  not: 'soru aninda ziyaret' },
  { id: 'claudebot',     ad: 'ClaudeBot',         sirket: 'Anthropic', ai: true,  not: 'model egitimi' },
  { id: 'claude-user',   ad: 'Claude-User',       sirket: 'Anthropic', ai: true,  not: 'soru aninda ziyaret' },
  { id: 'perplexitybot', ad: 'PerplexityBot',     sirket: 'Perplexity',ai: true,  not: 'arama indeksi' },
  { id: 'google-ext',    ad: 'Google-Extended',   sirket: 'Google',    ai: true,  not: 'Gemini / AI Overviews' },
  { id: 'applebot-ext',  ad: 'Applebot-Extended', sirket: 'Apple',     ai: true,  not: 'Apple Intelligence' },
  { id: 'ccbot',         ad: 'CCBot',             sirket: 'Common Crawl', ai: true, not: 'acik veri seti' },
  { id: 'bytespider',    ad: 'Bytespider',        sirket: 'ByteDance', ai: true,  not: 'model egitimi' },
  { id: 'meta-ext',      ad: 'meta-externalagent',sirket: 'Meta',      ai: true,  not: 'Llama / Meta AI' },
  { id: 'googlebot',     ad: 'Googlebot',         sirket: 'Google',    ai: false, not: 'klasik arama' },
  { id: 'bingbot',       ad: 'Bingbot',           sirket: 'Microsoft', ai: false, not: 'klasik arama + Copilot' },
];

// ---- ayristirma ----
export function ayristir(metin) {
  const gruplar = new Map();     // ua (kucuk harf) -> { allow:[], disallow:[], crawlDelay }
  const sitemapler = [];
  const hatalar = [];
  const bilinmeyen = new Map();  // direktif -> ilk deger (Content-Signal gibi)

  if (metin == null) return { varMi: false, gruplar, sitemapler, hatalar, bilinmeyen, bos: true };

  let aktifUA = [];              // su an kural yazilan user-agent'lar
  let sonSatirUAmiydi = false;   // ardisik UA satirlari tek grup olusturur

  metin.split(/\r?\n/).forEach((ham, i) => {
    const satirNo = i + 1;
    const satir = ham.replace(/#.*$/, '').trim();
    if (!satir) { sonSatirUAmiydi = false; return; }

    const ayrac = satir.indexOf(':');
    if (ayrac < 0) { hatalar.push({ satirNo, metin: ham.trim(), sorun: 'iki nokta yok — yok sayilir' }); return; }

    const alan = satir.slice(0, ayrac).trim().toLowerCase();
    const deger = satir.slice(ayrac + 1).trim();

    if (alan === 'user-agent') {
      if (!deger) { hatalar.push({ satirNo, metin: ham.trim(), sorun: 'user-agent bos' }); return; }
      if (!sonSatirUAmiydi) aktifUA = [];
      aktifUA.push(deger.toLowerCase());
      if (!gruplar.has(deger.toLowerCase())) gruplar.set(deger.toLowerCase(), { allow: [], disallow: [], crawlDelay: null });
      sonSatirUAmiydi = true;
      return;
    }
    sonSatirUAmiydi = false;

    if (alan === 'sitemap') {
      if (/^https?:\/\//i.test(deger)) sitemapler.push(deger);
      else hatalar.push({ satirNo, metin: ham.trim(), sorun: 'Sitemap satiri tam adres olmali (https://…)' });
      return;
    }

    if (YON_DIREKTIF.has(alan)) {
      if (!aktifUA.length) { hatalar.push({ satirNo, metin: ham.trim(), sorun: 'kural bir User-agent satirindan once geliyor — hicbir bota uygulanmaz' }); return; }
      // bos Disallow = kisit yok; bos Allow anlamsiz ama zararsiz
      if (deger) aktifUA.forEach(ua => gruplar.get(ua)[alan].push(deger));
      return;
    }

    if (alan === 'crawl-delay') {
      const n = Number(deger);
      if (aktifUA.length && !Number.isNaN(n)) aktifUA.forEach(ua => { gruplar.get(ua).crawlDelay = n; });
      return;
    }

    if (!BILINEN.has(alan)) bilinmeyen.set(alan, bilinmeyen.get(alan) ?? deger);
  });

  return { varMi: true, gruplar, sitemapler, hatalar, bilinmeyen, bos: gruplar.size === 0 && !sitemapler.length };
}

// ---- yol eslestirme ----
// Google spesifikasyonu: `*` joker, `$` satir sonu. Kural yolun basindan eslesir.
function kuralRegex(kural) {
  let s = kural, sonAnchor = false;
  if (s.endsWith('$')) { sonAnchor = true; s = s.slice(0, -1); }
  const kacis = s.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + kacis + (sonAnchor ? '$' : ''));
}

// Bir kural yolla esliyorsa eslesme uzunlugunu (kuralin ham uzunlugu) dondur, yoksa -1.
const eslesmeUzunlugu = (kural, yol) => kuralRegex(kural).test(yol) ? kural.replace(/\$$/, '').length : -1;

// Bot icin gecerli grubu sec: once tam ad (buyuk/kucuk harf duyarsiz), yoksa `*`.
export function grupSec(gruplar, bot) {
  const b = String(bot || '').toLowerCase();
  if (gruplar.has(b)) return gruplar.get(b);
  return gruplar.get('*') || null;
}

// bot bu yolu tarayabilir mi?
export function izinVar(ayrisim, bot, yol) {
  if (!ayrisim?.varMi) return { izin: true, kural: null, tip: 'robots yok' };
  const grup = grupSec(ayrisim.gruplar, bot);
  if (!grup) return { izin: true, kural: null, tip: 'kural yok' };

  let enIyi = { izin: true, kural: null, uzunluk: -1, tip: 'kural yok' };
  for (const tip of ['allow', 'disallow']) {
    for (const kural of grup[tip]) {
      const u = eslesmeUzunlugu(kural, yol);
      // esitlikte Allow kazanir -> disallow ancak KESIN uzunsa gecer
      if (u > enIyi.uzunluk || (u === enIyi.uzunluk && u >= 0 && tip === 'allow')) {
        if (u >= 0) enIyi = { izin: tip === 'allow', kural, uzunluk: u, tip };
      }
    }
  }
  return { izin: enIyi.izin, kural: enIyi.kural, tip: enIyi.tip };
}

// Site komple kapali mi (bot icin "/" bile yasak)?
export const tamamenKapali = (ayrisim, bot) => !izinVar(ayrisim, bot, '/').izin;

// ---- panel icin ozet ----
// yollar: taranan/planlanan sayfa yollari. Her bot icin kac sayfa engelli.
export function botOzeti(ayrisim, yollar) {
  const liste = yollar?.length ? yollar : ['/'];
  return AI_BOTLAR.map(b => {
    const engelli = liste.filter(y => !izinVar(ayrisim, b.ad, y).izin);
    return {
      id: b.id, ad: b.ad, sirket: b.sirket, ai: b.ai, not: b.not,
      izin: engelli.length === 0,
      engelliSayfa: engelli.length,
      toplamSayfa: liste.length,
      tamKapali: tamamenKapali(ayrisim, b.ad),
      kural: engelli.length ? izinVar(ayrisim, b.ad, engelli[0]).kural : null,
    };
  });
}

// Cloudflare "Content-Signal" gibi AI politikasi satirlari — hata degil, bilgi.
export function icerikSinyali(ayrisim) {
  const ham = ayrisim?.bilinmeyen?.get('content-signal');
  if (!ham) return null;
  const parcalar = Object.fromEntries(ham.split(',').map(p => p.split('=').map(x => x.trim())).filter(p => p.length === 2));
  return { ham, ...parcalar };
}
