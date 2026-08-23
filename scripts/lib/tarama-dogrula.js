// scripts/lib/tarama-dogrula.js
// TARAMA SAGLIK KONTROLU — bir taramanin sonucu gercek mi, yoksa WAF/challenge
// sayfasi mi? Karar ONCEKI taramayla karsilastirarak verilir.
//
// Neden var: 23 Agustos 2026 gecesi Cloudflare, GitHub runner'ini challenge
// sayfasina dusurdu. Bes sitenin de anasayfasi 8 kelimelik ara sayfa olarak
// geldi; robots.txt HTML dondu, sitemap 0 URL verdi, kuyruk bos kaldi ve her
// site "1 sayfa" tarandi. crawl.js bunu gercek veri sanip iyi verinin ustune
// yazdi -> panel "Ortalama 0 ic link/sayfa", "GA4 yok", "h1 yok" gibi hayali
// sorunlar gosterdi ve puanlar 95'ten 66'ya dustu.
//
// Saf fonksiyon: ag/dosya/DOM yok. Iki tarama nesnesi girer, karar cikar.

export const ESIKLER = {
  temelSayfa: 10,   // onceki tarama en az bu kadar sayfa gormediyse karsilastirma anlamsiz
  cokmeSayfa: 1,    // yeni tarama bu kadar veya daha az sayfa gorduyse: cokme (tek basina yeter)
  dususOran: 0.2,   // sayfa sayisi eskinin bu oranindan azaldiysa: sert dusus (bir sinyal)
  temelKelime: 100, // onceki ort. kelime bunun ustundeyse kelime sinyali olculebilir
  bosKelime: 30,    // yeni ort. kelime bunun altindaysa: govde bos (challenge sayfasi)
  temelLink: 5,     // onceki ort. ic link bunun ustundeyse link sinyali olculebilir
};

const sayi = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

// yeni: siteTara() ciktisi · eski: data.json'daki onceki kayit
// -> { gecerli, temelYok, neden: [{kod, mesaj}], ozet }
export function taramaDogrula(yeni, eski) {
  const eskiSayfa = sayi(eski?.sayfalar?.taranan) ?? 0;
  const yeniSayfa = sayi(yeni?.sayfalar?.taranan) ?? 0;

  // Ilk tarama (veya onceki de zaten cok kucuktu): kiyaslayacak saglam temel yok,
  // veriyi kabul et. Yoksa yeni eklenen site hic kaydedilemez.
  if (eskiSayfa < ESIKLER.temelSayfa) {
    return { gecerli: true, temelYok: true, neden: [], ozet: `ilk/kucuk tarama (onceki ${eskiSayfa} sayfa) — kiyas yapilmadi` };
  }

  const neden = [];
  const ekle = (kod, mesaj) => neden.push({ kod, mesaj });

  const cokme = yeniSayfa <= ESIKLER.cokmeSayfa;
  if (cokme) ekle('sayfa-cokusu', `${eskiSayfa} sayfadan ${yeniSayfa} sayfaya dustu — kuyruk hic dolmamis`);
  else if (yeniSayfa <= eskiSayfa * ESIKLER.dususOran)
    ekle('sayfa-dususu', `${eskiSayfa} → ${yeniSayfa} sayfa (%${Math.round((1 - yeniSayfa / eskiSayfa) * 100)} kayip)`);

  const eskiSm = sayi(eski?.sitemap?.urlSayisi) ?? 0;
  const yeniSm = sayi(yeni?.sitemap?.urlSayisi) ?? 0;
  if (eskiSm > 0 && yeniSm === 0)
    ekle('sitemap-bos', `sitemap.xml ${eskiSm} URL yerine 0 URL verdi — XML yerine HTML donmus olabilir`);

  if (eski?.robots?.varMi === true && yeni?.robots?.varMi === false)
    ekle('robots-kayboldu', 'robots.txt duz metin yerine HTML dondu — dosya "yok" sayildi');

  const eskiKelime = sayi(eski?.icerik?.ortKelime) ?? 0;
  const yeniKelime = sayi(yeni?.icerik?.ortKelime) ?? 0;
  if (eskiKelime >= ESIKLER.temelKelime && yeniKelime < ESIKLER.bosKelime)
    ekle('icerik-bos', `ort. kelime ${eskiKelime} → ${yeniKelime} — govde bos geldi`);

  const eskiLink = sayi(eski?.iclink?.ortLink) ?? 0;
  const yeniLink = sayi(yeni?.iclink?.ortLink) ?? 0;
  if (eskiLink >= ESIKLER.temelLink && yeniLink === 0)
    ekle('link-kayboldu', `ort. ic link ${eskiLink} → 0 — sayfalarda hic <a> bulunamadi`);

  // Karar: tam cokme tek basina yeter (bunu sadece engellenme yapar).
  // Tek basina her sinyal mesru olabilir (robots.txt gercekten silinmis olabilir),
  // bu yuzden digerlerinde en az iki sinyal ariyoruz.
  const gecerli = !(cokme || neden.length >= 2);
  const ozet = gecerli
    ? (neden.length ? `${neden.length} sinyal var ama esigin altinda — veri kabul edildi` : 'temiz')
    : `${neden.length} sinyal — tarama basarisiz sayildi`;

  return { gecerli, temelYok: false, neden, ozet };
}
