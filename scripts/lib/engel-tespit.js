// scripts/lib/engel-tespit.js
// ENGEL (challenge/WAF) TESPITI — bir HTTP yaniti gercek sayfa mi, yoksa
// bot dogrulama/engelleme sayfasi mi?
//
// Neden var: tarama-dogrula.js engellenmeyi ANCAK onceki taramayla kiyaslayarak
// anlar (sayfa 62 -> 1 dustuyse engel say). Bu iki yerde yetersiz kalir:
//   1) Yeni eklenen sitede kiyaslanacak temel yok -> engel "ilk tarama" sanilir.
//   2) Rapor "muhtemelen WAF" der; hangi urun, hangi kod, hangi kanit belirsizdir.
// Burasi yanitin KENDISINE bakip dogrudan karar verir: cf-mitigated basligi,
// challenge platformu betikleri, saglayiciya ozgu imzalar.
//
// Saf fonksiyon: ag yok. Durum kodu + basliklar + govde girer, karar cikar.

// Govdede aranan imzalar. Her saglayici icin: [saglayici adi, desen listesi]
const IMZALAR = [
  ['cloudflare', [
    /\/cdn-cgi\/challenge-platform\//i,   // challenge betiginin yolu
    /__cf_chl_/i,                          // challenge form/parametre adlari
    /cf-chl-/i,
    /<title>\s*just a moment/i,            // "Just a moment..." interstitial
    /attention required!\s*\|\s*cloudflare/i,
    /enable javascript and cookies to continue/i,
    /checking your browser before accessing/i,
  ]],
  ['sucuri',    [/sucuri\s*website\s*firewall/i, /cloudproxy@sucuri\.net/i]],
  ['imperva',   [/_incapsula_resource/i, /incapsula incident id/i]],
  ['awswaf',    [/awswaf|aws-waf-token/i]],
  ['datadome',  [/datadome/i, /geo\.captcha-delivery\.com/i]],
  ['akamai',    [/reference #\d+\.[0-9a-f]+/i, /akamai/i]],
];

// Bot dogrulamasinda kullanilan durum kodlari. 200 de olabilir (interstitial
// "Just a moment" sayfasi 200 doner) — bu yuzden kod TEK BASINA yetmez.
const SUPHELI_KOD = new Set([401, 403, 429, 503]);

const basligiOku = (basliklar, ad) => {
  if (!basliklar) return '';
  // fetch Headers nesnesi de, duz nesne de kabul edilsin
  if (typeof basliklar.get === 'function') return String(basliklar.get(ad) || '').toLowerCase();
  const k = Object.keys(basliklar).find(x => x.toLowerCase() === ad);
  return k ? String(basliklar[k] || '').toLowerCase() : '';
};

// -> { engel, saglayici, kod, kanit: [string], ozet }
export function engelTespit({ status = 0, basliklar = null, govde = '' } = {}) {
  const kanit = [];
  let saglayici = null;

  // 1) En guclu sinyal: Cloudflare bir istegi engellediginde/challenge ettiginde
  //    cf-mitigated basligini koyar. Govdeye bakmaya gerek kalmaz.
  const mitigated = basligiOku(basliklar, 'cf-mitigated');
  if (mitigated) { saglayici = 'cloudflare'; kanit.push(`cf-mitigated: ${mitigated}`); }

  // 2) Govde imzalari. Yalnizca kucuk govdelere bakariz: gercek bir sayfa da
  //    icinde "cloudflare" gecen bir metin barindirabilir; challenge sayfalari
  //    ise daima birkac KB'dir.
  const metin = typeof govde === 'string' ? govde : '';
  if (metin && metin.length < 60000) {
    for (const [ad, desenler] of IMZALAR) {
      const vuran = desenler.filter(d => d.test(metin));
      // akamai/datadome gibi genis desenlerde tek kelime yetmesin diye:
      // supheli kod yoksa en az iki desen istenir.
      const yeter = SUPHELI_KOD.has(status) ? vuran.length >= 1 : vuran.length >= 2;
      if (vuran.length && yeter) {
        saglayici = saglayici || ad;
        kanit.push(`govde imzasi (${ad}): ${vuran.length} desen`);
        break;
      }
    }
  }

  // 3) Supheli kod + WAF sunucusu, govde okunamamis olsa bile sinyaldir.
  if (!kanit.length && SUPHELI_KOD.has(status)) {
    const sunucu = basligiOku(basliklar, 'server');
    if (/cloudflare|sucuri|incapsula|akamai/.test(sunucu)) {
      saglayici = saglayici || sunucu.split('/')[0].trim();
      kanit.push(`HTTP ${status} + server: ${sunucu}`);
    }
  }

  const engel = kanit.length > 0;
  return {
    engel,
    saglayici: engel ? saglayici : null,
    kod: status,
    kanit,
    ozet: engel
      ? `${saglayici || 'WAF'} engeli (HTTP ${status}): ${kanit.join(' · ')}`
      : `engel yok (HTTP ${status})`,
  };
}

// Yanit nesnesinden dogrudan tespit yapmak icin kisayol (crawl.js istek() ciktisi).
export function yanittanEngel(y) {
  if (!y) return { engel: false, saglayici: null, kod: 0, kanit: [], ozet: 'yanit yok' };
  return engelTespit({ status: y.status ?? 0, basliklar: y.basliklar ?? null, govde: y.html ?? '' });
}
