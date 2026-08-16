// assets/saglik-motoru.js
// SAGLIK / TEMATIK SKOR MOTORU — panelin ve raporun ORTAK hesabi.
//
// oneri-motoru.js ile ayni kural: ne `export` ne `require`; sonunda globalThis'e yazar.
// Boylece hem tarayicida (index.html'de app.js'ten ONCE) hem Node'da (scripts/*.js `import`)
// ayni kod calisir.
//
// Iki tur kategori var — karistirmamak onemli:
//   tip:'puan'  -> crawl.js'in SEO puanindan DUSTUGU kalemler. Butun kategorilerin cezasi
//                  toplandiginda 100 - seo.puan cikar (puan 0 tabanina dayanmadiysa).
//                  Yani halkalar "puan neden bu" sorusunu cevaplar; uydurma agirlik yok.
//   tip:'olcum' -> puana HIC girmeyen bagimsiz olcumler (SSL, PageSpeed, CWV, hreflang,
//                  indeks). Bunlar oneri/uyari uretir ama puani oynatmaz.
//
// Ceza kalemleri birebir scripts/crawl.js'teki puanlama blogundan alinmistir.
// Orayi degistirirsen BURAYI da degistir; yoksa mutabakat satiri tutmaz.
//
// Saf fonksiyon: DOM, fetch, dosya sistemi YOK.

const TEMA_TANIM = [
  { id:'taranabilirlik', ad:'Taranabilirlik', kisa:'Tarama',  ik:'⌕',  tip:'puan',  butce:44, aciklama:'Google sayfalara ulaşabiliyor mu: sitemap, robots.txt, canonical, kırık link.' },
  { id:'markup',        ad:'Markup / Schema', kisa:'Markup',  ik:'◆',  tip:'puan',  butce:18, aciklama:'JSON-LD var mı ve Google\'ın zengin sonuç için beklediği alanlar dolu mu.' },
  { id:'onpage',        ad:'On-page & Meta',  kisa:'On-page', ik:'≡',  tip:'puan',  butce:36, aciklama:'title / description / H1, görsel alt text ve ölçüm kodu (GA4/GTM).' },
  { id:'icerik',        ad:'İçerik Derinliği',kisa:'İçerik',  ik:'✎',  tip:'puan',  butce:8,  aciklama:'İnce sayfa oranı. Eşik altındaki sayfalar sıralamada tutunamaz.' },
  { id:'iclink',        ad:'İç Linkleme',     kisa:'İç link', ik:'⋔',  tip:'puan',  butce:11, aciklama:'Sayfa başına ortalama iç link ve hiç link almayan (öksüz) sayfalar.' },
  { id:'yanit',         ad:'Sunucu Yanıtı',   kisa:'Yanıt',   ik:'⚡', tip:'puan',  butce:6,  aciklama:'Taranan sayfaların medyan yanıt süresi — tek sayfa ölçümü gürültülü olduğu için medyan.' },
  { id:'aihazir',       ad:'AI Hazırlığı',    kisa:'AI',      ik:'◎',  tip:'puan',  butce:2,  aciklama:'llms.txt — AI motorlarının siteyi doğru özetlemesi için.' },
  { id:'https',         ad:'HTTPS & SSL',     kisa:'SSL',     ik:'⛨',  tip:'olcum', aciklama:'Sertifika geçerli mi, ne zaman doluyor. Mixed content ve HTTP→HTTPS yönlendirmesi ölçülmüyor.' },
  { id:'hiz',           ad:'Site Hızı',       kisa:'Hız',     ik:'▲',  tip:'olcum', aciklama:'PageSpeed mobil/masaüstü puanı.' },
  { id:'cwv',           ad:'Core Web Vitals', kisa:'CWV',     ik:'◍',  tip:'olcum', aciklama:'LCP / INP / CLS. Kaynak lab (Lighthouse) ise gerçek kullanıcı verisi değildir.' },
  { id:'uluslararasi',  ad:'Uluslararası SEO',kisa:'hreflang',ik:'⌘',  tip:'olcum', aciklama:'Çok dilli sitede hreflang etiketleri.' },
  { id:'indeks',        ad:'İndeks Durumu',   kisa:'İndeks',  ik:'⊞',  tip:'olcum', aciklama:'Search Console URL Inspection ile gerçek indeks oranı.' },
];
const TEMA_HARITA = Object.fromEntries(TEMA_TANIM.map(t => [t.id, t]));

const enCok = (a, b) => Math.min(a, b);
const oran = (a, b) => (b ? a / b : 0);
const yuzde = (p) => p == null ? null : Math.max(0, Math.min(100, Math.round(p)));

// tek kalem: ceza>0 ise sorun, ceza=0 ise gecti. `bilgi:true` kalemler sadece baglam verir.
const kal = (ad, deger, ceza = 0, bilgi = false) => ({ ad, deger, ceza, bilgi });

// tarama dilleri: sayfa yollarindaki /tr /en /ru gibi on ekler (gercek kanit).
// sites.config.json'daki `diller` data.json'a tasinmadigi icin buradan cikariyoruz.
const DIL_KODU = /^(tr|en|de|ru|fr|ar|el|nl|it|es|pl|uk|he|fa)$/;
function taramaDilleri(s) {
  const yollar = s.sayfaYollari || [];
  return [...new Set(yollar.map(y => (String(y).split('/')[1] || '').toLowerCase()).filter(d => DIL_KODU.test(d)))];
}

// ---- tip:'puan' kategorileri — crawl.js ceza kalemlerinin birebir kirilimi ----
function puanKategorileri(s) {
  const toplam = s.sayfalar?.taranan || 0;
  const ko = s.kirikOzet || {}, em = s.eksikMeta || {}, op = s.onpage || {}, ic = s.iclink || {};
  const orphan = ic.orphan?.length || 0;
  const kirikCeza = enCok(20, (ko.ic || 0) * 3 + (ko.dis || 0));
  const yanitMs = s.uptime?.medyanMs ?? s.uptime?.yanitMs ?? null;
  const semaCeza = Math.round(oran(s.schema?.sorunluSayfa || 0, toplam) * 10);
  const inceCeza = Math.round(oran(s.icerik?.inceSayfa || 0, toplam) * 8);

  return {
    taranabilirlik: [
      kal('sitemap.xml', s.sitemap?.varMi ? `var — ${s.sitemap.urlSayisi} URL` : 'yok', s.sitemap?.varMi ? 0 : 8),
      kal('Sitemap erişilemez URL', s.sitemap?.erisilemez || 0, enCok(6, s.sitemap?.erisilemez || 0)),
      kal('robots.txt', s.robots?.varMi ? `var — ${s.robots.kuralSayisi ?? 0} kural` : 'yok', s.robots?.varMi ? 0 : 4),
      kal('Canonical eksik', `${s.canonical?.eksik || 0} sayfa`, enCok(6, s.canonical?.eksik || 0)),
      kal('Kırık link', `${ko.ic || 0} iç / ${ko.dis || 0} dış`, kirikCeza),
      // Asagidakiler crawl.js'in puanlamasinda YOK -> bilgi olarak gosterilir, ceza yazmaz.
      ...(s.robots?.sorun ? [kal('robots.txt hatası', `${s.robots.hatalar.length} satır — puana girmiyor`, 0, true)] : []),
      ...(s.sayfaDurum?.kirik ? [kal('Taramada hata veren sayfa', `${s.sayfaDurum.kirik} sayfa`, 0, true)] : []),
      ...(s.sayfaDurum?.yonlendirme ? [kal('Yönlendirilen sayfa', `${s.sayfaDurum.yonlendirme} sayfa`, 0, true)] : []),
      ...(s.sayfaDurum?.engelli ? [kal('robots.txt ile engelli', `${s.sayfaDurum.engelli} sayfa`, 0, true)] : []),
      ...(ko.dogrulanmamis ? [kal('Doğrulanmamış kırık', `${ko.dogrulanmamis} link — puana girmiyor`, 0, true)] : []),
    ],
    markup: [
      kal('JSON-LD schema', s.schema?.gecerli ? `geçerli — ${(s.schema.tipler || []).length} tip` : 'yok / geçersiz', s.schema?.gecerli ? 0 : 8),
      kal('Zorunlu alan eksiği', `${s.schema?.sorunluSayfa || 0}/${toplam} sayfa`, semaCeza),
      ...((s.schema?.eksikAlan || [])[0] ? [kal('En yaygın eksik', `${s.schema.eksikAlan[0].alan} (${s.schema.eksikAlan[0].adet})`, 0, true)] : []),
    ],
    onpage: [
      kal('Eksik description', `${em.description || 0} sayfa`, enCok(12, em.description || 0)),
      kal('Eksik title', `${em.title || 0} sayfa`, enCok(8, (em.title || 0) * 2)),
      kal('Eksik H1', `${em.h1 || 0} sayfa`, enCok(8, em.h1 || 0)),
      kal('Görsel alt text', `${op.altEksik || 0} görsel`, (op.altEksik || 0) > 10 ? 4 : 0),
      kal('Ölçüm kodu', op.tracking?.length ? op.tracking.join(' + ') : 'yok', op.tracking?.length ? 0 : 4),
      ...(op.ogEksik ? [kal('OG etiketi yok', `${op.ogEksik} sayfa — puana girmiyor`, 0, true)] : []),
    ],
    icerik: [
      kal(`İnce sayfa (<${s.icerik?.esik || 200} kelime)`, `${s.icerik?.inceSayfa || 0}/${toplam} sayfa`, inceCeza),
      kal('Ortalama kelime', s.icerik?.ortKelime ?? '—', 0, true),
    ],
    iclink: [
      kal('Ortalama iç link/sayfa', ic.ortLink ?? '—', (ic.ortLink != null && ic.ortLink < 5) ? 5 : 0),
      kal('Öksüz sayfa', orphan, enCok(6, orphan)),
    ],
    yanit: [
      kal(s.uptime?.medyanMs != null ? 'Medyan yanıt' : 'Anasayfa yanıtı (medyan yok)',
        yanitMs != null ? yanitMs + ' ms' : '—',
        yanitMs > 3000 ? 6 : yanitMs > 1500 ? 3 : 0),
    ],
    aihazir: [
      kal('llms.txt', s.llms?.varMi ? 'var' : 'yok', s.llms?.varMi ? 0 : 2),
      // AI bot izni puana GIRMEZ (engellemek gecerli bir tercih olabilir) ama en kritik bilgi.
      ...(s.robots?.botlar?.length
        ? [kal('AI botu erişimi', `${s.robots.toplamAi - s.robots.engelliAi}/${s.robots.toplamAi} serbest`, 0, true)]
        : []),
    ],
  };
}

// ---- tip:'olcum' kategorileri — kendi esikleriyle, puandan bagimsiz ----
function olcumKategorileri(s) {
  const out = {};

  // HTTPS: sadece sertifika. Mixed content ve http->https yonlendirmesi HENUZ olculmuyor.
  const ssl = s.ssl;
  out.https = ssl ? {
    puan: !ssl.gecerli ? 0 : ssl.kalanGun <= 14 ? 40 : ssl.kalanGun <= 30 ? 70 : 100,
    kalemler: [
      kal('Sertifika', ssl.gecerli ? 'geçerli' : 'geçersiz / erişilemez'),
      kal('Bitiş', ssl.bitis ? `${ssl.bitis} (${ssl.kalanGun} gün)` : '—'),
    ],
  } : { puan: null, kalemler: [kal('Sertifika', 'ölçülmedi')] };

  // Site hizi: mobil agirlikli (Google mobil-oncelikli indeksliyor)
  const h = s.hiz;
  out.hiz = (h && h.mobilPuan != null) ? {
    puan: yuzde((h.mobilPuan * 2 + (h.masaustuPuan ?? h.mobilPuan)) / 3),
    kalemler: [
      kal('Mobil', h.mobilPuan + '/100'),
      kal('Masaüstü', (h.masaustuPuan ?? '—') + '/100'),
      kal('Kaynak', h.kaynak === 'lab' ? 'lab (Lighthouse)' : (h.kaynak || '—'), 0, true),
    ],
  } : { puan: null, kalemler: [kal('PageSpeed', 'ölçülmedi — npm run hiz')] };

  // CWV: her metrik iyi=1, orta=0.5, kotu=0. Lab olcumunde INP guvenilir degil (0 gelir) -> disari.
  if (h && (h.lcp != null || h.cls != null)) {
    const bas = [];
    const not = (ad, v, iyi, orta, birim) => {
      if (v == null) return;
      bas.push(v <= iyi ? 1 : v <= orta ? 0.5 : 0);
      out._cwvKalem = out._cwvKalem || [];
      out._cwvKalem.push(kal(ad, v + birim, v <= iyi ? 0 : 1));
    };
    not('LCP', h.lcp, 2.5, 4, ' s');
    if (h.kaynak === 'lab' && !h.inp) out._cwvKalem = [...(out._cwvKalem || []), kal('INP', 'lab ölçümünde alınamaz', 0, true)];
    else not('INP', h.inp, 200, 500, ' ms');
    not('CLS', h.cls, 0.1, 0.25, '');
    out.cwv = { puan: bas.length ? yuzde(bas.reduce((a, b) => a + b, 0) / bas.length * 100) : null, kalemler: out._cwvKalem || [] };
    if (h.kaynak === 'lab') out.cwv.kalemler.push(kal('Kaynak', 'lab (CrUX değil)', 0, true));
    delete out._cwvKalem;
  } else out.cwv = { puan: null, kalemler: [kal('Core Web Vitals', 'ölçülmedi — npm run hiz')] };

  // Uluslararasi SEO: sadece cok dilli sitede anlamli
  const diller = taramaDilleri(s);
  out.uluslararasi = diller.length > 1
    ? { puan: s.hreflang?.sorun ? 0 : 100, kalemler: [
        kal('Taranan diller', diller.join(', ')),
        kal('hreflang', s.hreflang?.sorun ? 'eksik / tutarsız' : 'var', s.hreflang?.sorun ? 1 : 0),
      ] }
    : { puan: null, kalemler: [kal('Dil', diller[0] ? `tek dilli (${diller[0]})` : 'tek dilli'), kal('hreflang', 'gerekmiyor', 0, true)] };

  // Indeks: GSC URL Inspection
  const i = s.indeks;
  out.indeks = (i && i.kontrolEdilen) ? {
    puan: yuzde(oran(i.indeksli, i.kontrolEdilen) * 100),
    kalemler: [
      kal('İndeksli', `${i.indeksli}/${i.kontrolEdilen} kontrol edilen`),
      kal('Aksiyon gereken', i.aksiyonGereken ?? i.indekssiz, (i.aksiyonGereken || 0) ? 1 : 0),
      ...(i.toplamSayfa && i.toplamSayfa !== i.kontrolEdilen ? [kal('Kapsam', `${i.kontrolEdilen}/${i.toplamSayfa} sayfa örneklendi`, 0, true)] : []),
    ],
  } : { puan: null, kalemler: [kal('URL Inspection', 'ölçülmedi — npm run indeks')] };

  return out;
}

// ---- tek sitenin tam tematik tablosu ----
function siteSaglik(s) {
  const pk = puanKategorileri(s);
  const ok = olcumKategorileri(s);
  const kategoriler = TEMA_TANIM.map(t => {
    if (t.tip === 'puan') {
      const kalemler = pk[t.id] || [];
      const ceza = kalemler.reduce((a, k) => a + k.ceza, 0);
      return { ...t, ceza, puan: yuzde(100 * (1 - ceza / t.butce)), kalemler };
    }
    const o = ok[t.id] || { puan: null, kalemler: [] };
    return { ...t, ceza: 0, puan: o.puan, kalemler: o.kalemler };
  });

  // mutabakat: puan kategorilerinin toplam cezasi = 100 - crawl.js puani (0 tabanina dayanmadiysa)
  const ceza = kategoriler.filter(k => k.tip === 'puan').reduce((a, k) => a + k.ceza, 0);
  const hesaplanan = Math.max(0, 100 - ceza);
  return { kategoriler, ceza, hesaplanan, puan: s.seo?.puan ?? null, uyum: s.seo?.puan === hesaplanan };
}

// ---- portfoy: kategori bazli ortalama (null'lar sayilmaz) ----
function portfoySaglik(siteListesi) {
  const l = siteListesi || [];
  const hepsi = l.map(s => ({ site: s, saglik: siteSaglik(s) }));
  const kategoriler = TEMA_TANIM.map(t => {
    const puanlar = hepsi.map(h => h.saglik.kategoriler.find(k => k.id === t.id)?.puan).filter(p => p != null);
    return { ...t, puan: puanlar.length ? Math.round(puanlar.reduce((a, b) => a + b, 0) / puanlar.length) : null,
      olculen: puanlar.length, toplam: hepsi.length };
  });
  return { kategoriler, siteler: hepsi };
}

// ---- sayfa dagilimi (Semrush "Crawled Pages" karsiligi) ----
// crawl.js her URL icin TEK durum satiri tutar: saglam / sorunlu / kirik / yonlendirme /
// engelli. Bu bes kategori ortusmez, toplami taranan URL sayisini verir.
// `kalemler` ise sorun TURLERI — bunlar cakisir (ayni sayfa hem ince hem schema'siz olabilir).
function sayfaDagilim(siteListesi) {
  const l = siteListesi || [];
  const t = (f) => l.reduce((a, s) => a + (f(s) || 0), 0);
  const taranan = t(s => s.sayfalar?.taranan);
  const durumVar = l.some(s => s.sayfaDurum);
  const durum = durumVar ? {
    toplam:      t(s => s.sayfaDurum?.toplam),
    saglam:      t(s => s.sayfaDurum?.saglam),
    sorunlu:     t(s => s.sayfaDurum?.sorunlu),
    kirik:       t(s => s.sayfaDurum?.kirik),
    yonlendirme: t(s => s.sayfaDurum?.yonlendirme),
    engelli:     t(s => s.sayfaDurum?.engelli),
  } : null;
  return {
    taranan, durum,
    indekslenebilir: t(s => s.sayfalar?.indekslenebilir),
    noindex: t(s => s.sayfalar?.noindex),
    kalemler: [
      { ad: 'İnce içerik', adet: t(s => s.icerik?.inceSayfa), ton: 'warn' },
      { ad: 'Schema alanı eksik', adet: t(s => s.schema?.sorunluSayfa), ton: 'warn' },
      { ad: 'Eksik meta (title/desc/H1)', adet: t(s => (s.eksikMeta?.title || 0) + (s.eksikMeta?.description || 0) + (s.eksikMeta?.h1 || 0)), ton: 'warn' },
      { ad: 'Canonical eksik', adet: t(s => s.canonical?.eksik), ton: 'warn' },
      { ad: 'Öksüz (iç link almayan)', adet: t(s => s.iclink?.orphan?.length), ton: 'warn' },
      { ad: 'Kırık link hedefi', adet: t(s => (s.kirikOzet?.ic || 0) + (s.kirikOzet?.dis || 0)), ton: 'bad' },
    ].filter(k => k.adet > 0),
  };
}

// ---- AI / GEO sagligi (Semrush "AI Search Health" karsiligi) ----
// Bilesenlerin HEPSI olculmus gercek veri. Olculemeyenler ayrica dondurulur ki
// kart "%100 hazir" gibi bir yanilsama yaratmasin.
function aiSaglik(siteListesi) {
  const l = siteListesi || [];
  if (!l.length) return null;
  const n = l.length;
  const oranla = (f) => Math.round(l.filter(f).length / n * 100);

  // robots.txt'te AI botlarina verilen erisim (crawl.js govdeyi ayristirdiktan sonra doldu)
  const robotslu = l.filter(s => s.robots?.botlar?.length);
  const botErisim = robotslu.length
    ? Math.round(robotslu.reduce((a, s) => a + (s.robots.toplamAi ? (s.robots.toplamAi - s.robots.engelliAi) / s.robots.toplamAi : 1), 0) / robotslu.length * 100)
    : null;

  const bilesen = [
    ...(botErisim != null ? [{ ad: 'AI bot erişimi', puan: botErisim, aciklama: 'robots.txt AI botlarını engellemiyor' }] : []),
    { ad: 'llms.txt', puan: oranla(s => s.llms?.varMi), aciklama: 'AI motorlarına site özeti' },
    { ad: 'Geçerli schema', puan: oranla(s => s.schema?.gecerli), aciklama: 'Varlıkları makine okuyabiliyor' },
    { ad: 'Schema alanları tam', puan: Math.round(l.reduce((a, s) => a + (1 - oran(s.schema?.sorunluSayfa || 0, s.sayfalar?.taranan || 1)), 0) / n * 100), aciklama: 'Zorunlu alanlar dolu' },
    { ad: 'Yeterli içerik derinliği', puan: Math.round(l.reduce((a, s) => a + (1 - oran(s.icerik?.inceSayfa || 0, s.sayfalar?.taranan || 1)), 0) / n * 100), aciklama: 'Alıntılanacak gövde var' },
  ];
  const puan = Math.round(bilesen.reduce((a, b) => a + b.puan, 0) / bilesen.length);

  // gercekten olculmus GEO gorunurlugu (uydurma yok: _geoGercek isaretli site yoksa null)
  const geoluSiteler = l.filter(s => s.geo);
  const motorlar = ['chatgpt', 'perplexity', 'gemini', 'claude'];
  const gorunurluk = geoluSiteler.length ? motorlar.map(m => ({
    motor: m,
    gorulen: geoluSiteler.filter(s => s.geo[m]).length,
    olculen: geoluSiteler.filter(s => s.geo[m] !== undefined).length,
  })).filter(x => x.olculen) : [];

  const botlu = l.filter(s => s.aiBotlar);
  return {
    puan, bilesen, gorunurluk,
    olculenSite: geoluSiteler.length, toplamSite: n,
    eksikOlcum: [
      ...(robotslu.length ? [] : ['robots.txt AI bot izinleri — npm run crawl']),
      ...(botlu.length ? [] : ['AI bot ziyaret logu — npm run botlog']),
      ...(geoluSiteler.length ? [] : ['AI motor görünürlüğü — npm run geo']),
    ],
  };
}

// ---- AI aramaya kapali botlar (Semrush "Blocked from AI Search" karsiligi) ----
// Bot bazinda: kac sitede engelli, toplam kac sayfa kapali. Sirala: en cok engellenen once.
function aiBotEngeli(siteListesi) {
  const l = (siteListesi || []).filter(s => s.robots?.botlar?.length);
  if (!l.length) return null;
  const harita = new Map();
  l.forEach(s => (s.robots.botlar || []).forEach(b => {
    const k = harita.get(b.id) || { id: b.id, ad: b.ad, sirket: b.sirket, ai: b.ai, not: b.not,
      engelliSite: 0, toplamSite: 0, engelliSayfa: 0, toplamSayfa: 0, siteler: [] };
    k.toplamSite++;
    k.toplamSayfa += b.toplamSayfa || 0;
    if (!b.izin) { k.engelliSite++; k.engelliSayfa += b.engelliSayfa || 0; k.siteler.push({ ad: s.ad, sayfa: b.engelliSayfa, tam: b.tamKapali }); }
    harita.set(b.id, k);
  }));
  const hepsi = [...harita.values()].sort((a, b) => (b.engelliSayfa - a.engelliSayfa) || (a.ai === b.ai ? 0 : a.ai ? -1 : 1));
  return {
    botlar: hepsi,
    engelliOlanlar: hepsi.filter(b => b.engelliSite),
    taranan: l.reduce((a, s) => a + (s.sayfaDurum?.toplam || s.sayfalar?.taranan || 0), 0),
    siteSayisi: l.length,
    // Cloudflare "Content-Signal" gibi AI politikasi bildirimleri
    sinyaller: l.filter(s => s.robots?.aiSinyal).map(s => ({ site: s.ad, ...s.robots.aiSinyal })),
  };
}

Object.assign(globalThis, { TEMA_TANIM, TEMA_HARITA, siteSaglik, portfoySaglik, sayfaDagilim, aiSaglik, aiBotEngeli, taramaDilleri });
