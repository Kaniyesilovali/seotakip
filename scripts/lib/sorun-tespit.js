// scripts/lib/sorun-tespit.js
// SAYFA/SITE SORUN TESPITI — saf fonksiyonlar.
//
// Neden ayri dosya: crawl.js HTTP yapiyor, bu yuzden test edilemiyordu. Buradaki
// fonksiyonlarin hicbiri ag/dosya/DOM'a dokunmaz — ayristirilmis sayfa nesnesi girer,
// bulgu listesi cikar. test/birim.test.js bunlari dogrudan cagirir.
//
// Bulgu bicimi:  { tip, adet, ornekler: [{ yol, deger }] }
//   tip      assets/sorun-katalogu.js icindeki anahtar (seviye/aciklama oradan gelir)
//   adet     kac sayfa/kalem etkilendi
//   ornekler panelde "hangi sayfa" sorusunu cevaplayan sinirli liste
//
// ONEMLI: buradaki bulgular SEO PUANINA GIRMEZ (katalogdaki puana:false). Puan formulu
// eski taramalarla karsilastirilabilir kalsin diye dondurulmustur; yeni kontroller once
// raporlanir. Bkz. README "SEO puani nasil hesaplanir".

// ---- esikler (tek yerde; test de buradan okur) ----
export const ESIK = {
  titleMin: 30, titleMax: 60,
  descMin: 70, descMax: 160,
  derinlik: 3,        // bundan DERIN sayfalar (tiklama uzakligi > 3) bulgu uretir
  yavasMs: 2000,      // sayfa basina yanit suresi esigi
  yinelenenMinKelime: 50,  // bu kelimenin altindaki sayfalar yinelenen-icerik karsilastirmasina girmez
  ornekLimit: 10,
};

// ---- metin parmak izi (yinelenen icerik) ----
// Kriptografik olmasi gerekmiyor; sadece "ayni gorunur metin mi" sorusuna cevap.
// FNV-1a 32-bit + uzunluk: cakisma ihtimali bu olcekte ihmal edilebilir.
export function metinParmakIzi(metin) {
  const s = String(metin || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!s) return null;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16) + '-' + s.length;
}

// ---- baslik hiyerarsisi ----
// seviyeler: sayfadaki basliklarin sirali seviye dizisi, or. [1,2,2,4] -> H2'den H4'e atlanmis.
// H1'in kendisi eksikse ayri bir bulgu (h1-yok) var; burada sadece ATLAMA'ya bakariz.
export function baslikAtlamasi(seviyeler) {
  const l = (seviyeler || []).filter(n => Number.isInteger(n) && n >= 1 && n <= 6);
  if (l.length < 2) return null;
  let enDerin = l[0];
  for (let i = 1; i < l.length; i++) {
    const s = l[i];
    // Sadece ASAGI dogru atlama sorundur: H2'den sonra H4. Yukari cikmak (H4 -> H2) normaldir.
    if (s > enDerin + 1) return { onceki: enDerin, sonraki: s };
    if (s > enDerin) enDerin = s;
    else enDerin = s;
  }
  return null;
}

// ---- tiklama derinligi ----
// Kok sayfadan ic link grafinde BFS. Sitemap'ten taranan ama hicbir sayfadan link
// almayan URL'ler ulasilamaz kalir -> null (zaten oksuz-sayfa bulgusu onlari yakalar).
export function derinlikHesapla(kokUrl, sayfalar) {
  const derinlik = new Map();
  if (!sayfalar || !sayfalar.size) return derinlik;
  const baslangic = sayfalar.has(kokUrl) ? kokUrl : [...sayfalar.keys()][0];
  derinlik.set(baslangic, 0);
  const kuyruk = [baslangic];
  while (kuyruk.length) {
    const u = kuyruk.shift();
    const d = derinlik.get(u);
    const p = sayfalar.get(u);
    for (const hedef of (p?.icLink || [])) {
      if (!sayfalar.has(hedef) || derinlik.has(hedef)) continue;
      derinlik.set(hedef, d + 1);
      kuyruk.push(hedef);
    }
  }
  return derinlik;
}

// ---- yinelenen deger gruplari ----
// Bir alanin ayni degeri tasiyan sayfalarini gruplar. Tek basina duran degerler elenir.
export function yinelenenGruplar(girdiler) {
  const harita = new Map();
  for (const { yol, deger } of girdiler) {
    if (deger == null || deger === '') continue;
    const k = harita.get(deger) || [];
    k.push(yol);
    harita.set(deger, k);
  }
  return [...harita.entries()]
    .filter(([, yollar]) => yollar.length > 1)
    .map(([deger, yollar]) => ({ deger, yollar, adet: yollar.length }))
    .sort((a, b) => b.adet - a.adet);
}

// ---- HTTP durum sinifi ----
// 403/429 ve bot dogrulama sayfalari "kirik" degildir; ayri raporlanir ki
// "sitende 30 kirik sayfa var" yanilsamasi olusmasin.
export function durumSinifi(kod, govde = '') {
  if (kod === 403 || kod === 429 || kod === 999) return 'engellenen';
  if (/just a moment|cf-browser-verification|checking your browser|attention required/i.test(govde || '')) return 'engellenen';
  if (kod >= 500 && kod < 600) return 'sunucu-hatasi';
  if (kod >= 400 && kod < 500) return 'sayfa-hatasi';
  return null;
}

// ---- tek sayfa bulgulari ----
// p: sayfaAyristir() ciktisi + { yol, sure, derinlik, kendiUrl }
// Donen: tip listesi (string[]). Adet/ornek toplamayi cagiran yapar.
export function sayfaSorunlari(p) {
  const t = [];
  const title = p.title || '';
  const desc = p.desc || '';
  if (title) {
    if (title.length > ESIK.titleMax) t.push(['title-uzun', `${title.length} karakter`]);
    else if (title.length < ESIK.titleMin) t.push(['title-kisa', `${title.length} karakter`]);
  }
  if (desc) {
    if (desc.length > ESIK.descMax) t.push(['description-uzun', `${desc.length} karakter`]);
    else if (desc.length < ESIK.descMin) t.push(['description-kisa', `${desc.length} karakter`]);
  }
  if (p.h1 > 1) t.push(['coklu-h1', `${p.h1} adet H1`]);
  const atlama = baslikAtlamasi(p.baslikSeviyeleri);
  if (atlama) t.push(['baslik-atlama', `H${atlama.onceki} -> H${atlama.sonraki}`]);
  if ((p.icLink || []).length === 0) t.push(['giden-link-yok', 'hic ic link yok']);
  if (p.noindex) t.push(['noindex-sayfa', p.noindexKaynak || 'meta robots']);
  // Celiskili canonical: birden fazla FARKLI canonical, ya da canonical + noindex birlikte.
  if ((p.canonicalListe || []).length > 1) t.push(['canonical-cakismasi', `${p.canonicalListe.length} farkli canonical`]);
  else if (p.canonical && p.noindex) t.push(['canonical-cakismasi', 'canonical + noindex birlikte']);
  // Kendi adresinden baskasini gosteren canonical (bilincli olabilir -> sadece bilgi).
  if (p.canonical && p.kendiUrl && !ayniAdres(p.canonical, p.kendiUrl)) t.push(['canonical-baskasina', kisalt(p.canonical)]);
  if (p.sure != null && p.sure > ESIK.yavasMs) t.push(['yavas-yanit', `${p.sure} ms`]);
  if (p.derinlik != null && p.derinlik > ESIK.derinlik) t.push(['derin-sayfa', `${p.derinlik} tiklama`]);
  return t;
}

const kisalt = (s, n = 60) => (String(s).length > n ? String(s).slice(0, n) + '…' : String(s));

// canonical karsilastirmasi: sondaki egik cizgi, hash ve www farki onemsiz.
export function ayniAdres(a, b) {
  const d = (u) => {
    try {
      const x = new URL(u);
      x.hash = ''; x.search = x.search;
      return x.host.replace(/^www\./, '') + (x.pathname.replace(/\/$/, '') || '/');
    } catch { return String(u); }
  };
  return d(a) === d(b);
}

// ---- site geneli bulgu toplama ----
// girdi: {
//   kok, sayfalar: Map<url, p>, kayit: [{yol,durum,kod,adim,dongu,...}],
//   yollar: Map<url, yol>, sureler: Map<url, ms>
// }
export function siteSorunlari({ kok, sayfalar, kayit = [], yollar = new Map(), sureler = new Map() }) {
  const bulgular = new Map();
  const ekle = (tip, yol, deger) => {
    const b = bulgular.get(tip) || { tip, adet: 0, ornekler: [] };
    b.adet++;
    if (b.ornekler.length < ESIK.ornekLimit) b.ornekler.push({ yol, deger });
    bulgular.set(tip, b);
  };

  const derinlikler = derinlikHesapla(kok, sayfalar);
  const yolAl = (u) => yollar.get(u) || (() => { try { return new URL(u).pathname || '/'; } catch { return u; } })();

  // 1) sayfa bazli bulgular
  for (const [u, p] of sayfalar) {
    const yol = yolAl(u);
    const zengin = { ...p, yol, kendiUrl: u, sure: sureler.get(u) ?? null, derinlik: derinlikler.get(u) ?? null };
    for (const [tip, deger] of sayfaSorunlari(zengin)) ekle(tip, yol, deger);
  }

  // 2) yinelenenler — sayfa bazinda degil grup bazinda anlamli
  const yinele = (tip, secici, bicim) => {
    const gruplar = yinelenenGruplar([...sayfalar.entries()].map(([u, p]) => ({ yol: yolAl(u), deger: secici(p) })));
    for (const g of gruplar) {
      const b = bulgular.get(tip) || { tip, adet: 0, ornekler: [] };
      b.adet += g.adet;
      if (b.ornekler.length < ESIK.ornekLimit) {
        b.ornekler.push({ yol: g.yollar.slice(0, 3).join(', ') + (g.yollar.length > 3 ? ` (+${g.yollar.length - 3})` : ''), deger: bicim(g) });
      }
      bulgular.set(tip, b);
    }
  };
  yinele('yinelenen-title', p => p.title, g => kisalt(g.deger));
  yinele('yinelenen-description', p => p.desc, g => kisalt(g.deger));
  yinele('yinelenen-icerik', p => (p.kelime >= ESIK.yinelenenMinKelime ? p.metinIzi : null), g => `${g.adet} sayfa ayni govde`);

  // 3) durum satirlarindan gelen bulgular (yonlendirme/hata sinifi)
  for (const k of kayit) {
    if (k.durum === 'yonlendirme') {
      if (k.dongu) ekle('yonlendirme-dongusu', k.yol, `${k.adim} adim`);
      else if ((k.adim || 1) >= 2) ekle('yonlendirme-zinciri', k.yol, `${k.adim} adim -> ${kisalt(k.hedef || '')}`);
    } else if (k.durum === 'kirik') {
      const sinif = k.sinif || durumSinifi(k.kod);
      if (sinif === 'engellenen') ekle('engellenen-sayfa', k.yol, `HTTP ${k.kod}`);
      else if (sinif === 'sunucu-hatasi') ekle('sunucu-hatasi', k.yol, `HTTP ${k.kod}`);
      else ekle('sayfa-hatasi', k.yol, k.kod ? `HTTP ${k.kod}` : (k.hata || 'erisilemedi'));
    }
  }

  return [...bulgular.values()].sort((a, b) => b.adet - a.adet);
}
