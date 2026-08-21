// assets/sorun-katalogu.js
// SORUN KATALOGU — her denetim bulgusunun tek kayit yeri.
//
// oneri-motoru.js / saglik-motoru.js ile ayni kural: ne `export` ne `require`;
// sonunda globalThis'e yazar. Hem tarayicida (panel) hem Node'da (crawl, rapor,
// telegram, mcp) ayni metinler okunur.
//
// Neden ayri dosya: eskiden bir sayfa sorunu uc yerde ayri ayri yaziliydi
// (crawl.js'te kisa etiket, panelde baska cumle, raporda ucuncu bir cumle).
// Artik tek kaynak: `tip` alani her yerde ayni, aciklama ve cozum buradan gelir.
//
// Alanlar:
//   seviye  'kritik' | 'uyari' | 'bilgi'   — sorunun agirligi
//   baslik  panelde/raporda gorunen ad
//   neden   niye onemli (kullaniciya aciklama)
//   nasil   nasil duzeltilir (aksiyon)
//   puana   bu bulgu SEO puanina giriyor mu (bkz. README "SEO puani nasil hesaplanir")
//
// puana:false olanlar bilincli: puan formulu eski taramalarla karsilastirilabilir
// kalsin diye dondurulmustur. Yeni kontroller once RAPORLANIR, puana girmez.

const SORUN_KATALOG = {
  // ---------- kritik ----------
  'title-yok': {
    seviye: 'kritik', puana: true, baslik: 'Title etiketi yok',
    neden: 'Title en guclu on-page alaka sinyali ve arama sonucunda gorunen baslik. Yoksa Google baslik uydurur, genelde kotu uydurur.',
    nasil: 'Sayfanin ana konusunu iceren, 30-60 karakterlik benzersiz bir <title> ekle.',
  },
  'kirik-ic-link': {
    seviye: 'kritik', puana: true, baslik: 'Kirik ic link',
    neden: 'Kendi sayfan kendi sayfana 404 veriyor. Tarama butcesi bosa gider, link degeri kaybolur, kullanici duvara toslar.',
    nasil: 'Linki dogru adrese guncelle veya kaldir. Sayfa tasindiysa yonlendirmeye guvenme, dogrudan yeni adrese link ver.',
  },
  'sunucu-hatasi': {
    seviye: 'kritik', puana: false, baslik: 'Sunucu hatasi (5xx)',
    neden: 'Sayfa 5xx donuyor. Tekrarlayan sunucu hatasi goren arama motoru siteyi daha az tarar ve sayfayi indeksten dusurebilir.',
    nasil: 'Sunucu loguna bak ve hatayi coz. Sayfa kalktiysa 404/410 don veya ilgili bir sayfaya yonlendir.',
  },
  'engellenen-sayfa': {
    seviye: 'kritik', puana: false, baslik: 'Tarayici engellendi',
    neden: 'Sayfa yerine bot dogrulamasi / erisim reddi dondu (403, 429, Cloudflare challenge). Sayfa denetlenemedi; arama motorlari da ayni surtunmeyi yasiyor olabilir.',
    nasil: 'WAF/bot korumasinda kendi tarayici ajanina (SeoTakipBot) izin ver, sonra taramayi tekrarla.',
  },
  'robots-tamamen-kapali': {
    seviye: 'kritik', puana: false, baslik: 'robots.txt taramayi tamamen engelliyor',
    neden: 'robots.txt bu botun tum sayfalara erisimini kapatiyor — denetim yapilamiyor.',
    nasil: 'robots.txt\'te ilgili Disallow kuralini gevset veya bota ozel Allow ekle.',
  },

  // ---------- uyari ----------
  'sayfa-hatasi': {
    seviye: 'uyari', puana: false, baslik: 'Sayfa hata donuyor (4xx)',
    neden: 'Taranan URL istemci hatasi verdi (genelde 404). Sitemap\'te veya ic linklerde duruyorsa tarayicilar bosa istek atmaya devam eder.',
    nasil: 'Sayfa var olmaliysa geri getir. Bilerek kaldirildiysa sitemap ve ic linklerden cikar, en yakin canli sayfaya 301 dusun.',
  },
  'description-yok': {
    seviye: 'uyari', puana: true, baslik: 'Meta description yok',
    neden: 'Arama sonucundaki ozet metni. Yoksa Google sayfadan rastgele bir parca keser; tiklama orani duser.',
    nasil: 'Sayfaya ozel, 70-160 karakterlik, aksiyon vaat eden bir description yaz.',
  },
  'h1-yok': {
    seviye: 'uyari', puana: true, baslik: 'H1 basligi yok',
    neden: 'H1 sayfanin ana konusunu hem kullaniciya hem tarayiciya soyler. Yoksa sayfa hiyerarsisi belirsiz kalir.',
    nasil: 'Sayfaya konuyu ozetleyen tek bir <h1> ekle.',
  },
  'coklu-h1': {
    seviye: 'uyari', puana: false, baslik: 'Birden fazla H1',
    neden: 'Birden cok H1 sayfanin ana konusunu bulanlastirir; hangi baslik asil konu belli olmaz.',
    nasil: 'Tek H1 birak, digerlerini H2/H3 yap. Cogu temada slider/logo yanlislikla H1 olur — oralara bak.',
  },
  'canonical-yok': {
    seviye: 'uyari', puana: true, baslik: 'Canonical etiketi yok',
    neden: 'Ayni icerige birden fazla URL\'den ulasilabiliyorsa (parametre, sondaki egik cizgi, www) Google hangisini indeksleyecegini kendi secer.',
    nasil: 'Her sayfaya kendi mutlak adresini gosteren <link rel="canonical"> ekle.',
  },
  'canonical-cakismasi': {
    seviye: 'uyari', puana: false, baslik: 'Celiskili canonical sinyali',
    neden: 'Sayfada birden fazla farkli canonical var ya da canonical ile noindex ayni anda duruyor. Celiskili sinyalde Google ikisini de yok sayabilir.',
    nasil: 'Tek bir canonical birak. Sayfa indekslenmeyecekse canonical\'i kaldir, sadece noindex kalsin.',
  },
  'yinelenen-title': {
    seviye: 'uyari', puana: false, baslik: 'Yinelenen title',
    neden: 'Birden fazla sayfa ayni title\'i tasiyor. Google sayfalari title ile ayirir; ayni olunca sayfalar birbiriyle yarisir ve tiklama orani duser.',
    nasil: 'Her sayfaya kendi icerigini anlatan benzersiz bir title yaz. Sablon sayfalarda ayirt edici alani (isim, kategori, sehir) sablona koy.',
  },
  'yinelenen-description': {
    seviye: 'uyari', puana: false, baslik: 'Yinelenen meta description',
    neden: 'Ayni description birden fazla sayfada. Arama sonucunda ayni ozet cikar, kullanici sayfalari ayirt edemez.',
    nasil: 'Sayfa basina benzersiz description yaz; yazamiyorsan yinelenen olani tamamen kaldir — Google\'in uretecegi ozet yanlis bir kopyadan iyidir.',
  },
  'yinelenen-icerik': {
    seviye: 'uyari', puana: false, baslik: 'Yinelenen sayfa icerigi',
    neden: 'Iki veya daha fazla URL ayni gorunur metni sunuyor. Google birini indeksleyip digerlerini yok sayar, siralama sinyalleri boluner.',
    nasil: 'Asil surumu sec ve digerlerinden ona canonical ver; gereksiz kopyalari birlestir veya kaldir.',
  },
  'yonlendirme-zinciri': {
    seviye: 'uyari', puana: false, baslik: 'Yonlendirme zinciri',
    neden: 'URL son adrese birden fazla adimda ulasiyor. Her adim tarama butcesi harcar ve bir miktar link degeri sizdirir.',
    nasil: 'Ic linkleri ve sitemap\'i dogrudan SON adrese guncelle; ara yonlendirmeyi tek adima indir.',
  },
  'yonlendirme-dongusu': {
    seviye: 'uyari', puana: false, baslik: 'Yonlendirme dongusu',
    neden: 'URL kendine geri donen bir yonlendirme halkasinda. Sayfa hicbir zaman acilmaz; ne kullanici ne tarayici ulasabilir.',
    nasil: 'Yonlendirme kurallarini incele — genelde iki kural (www/egik cizgi/dil on eki) birbirini geri cevirir.',
  },
  'ince-icerik': {
    seviye: 'uyari', puana: true, baslik: 'Ince icerik',
    neden: 'Sayfa esik altinda kelime iceriyor. Az icerikli sayfa bir soruyu tam cevaplamaz, siralamada tutunamaz ve AI motorlari da alintilayacak govde bulamaz.',
    nasil: 'Sayfayi konuyu gercekten cevaplayacak sekilde derinlestir; derinlesemeyecekse ilgili bir sayfayla birlestir.',
  },
  'alt-eksik': {
    seviye: 'uyari', puana: true, baslik: 'Gorsellerde alt metni yok',
    neden: 'alt metni hem gorsel aramasinin tek sinyali hem de ekran okuyucularin gordugu tek metin.',
    nasil: 'Her anlamli gorsele ne gosterdigini anlatan kisa bir alt yaz. Dekoratif gorsellerde alt="" birak.',
  },
  'oksuz-sayfa': {
    seviye: 'uyari', puana: true, baslik: 'Oksuz sayfa',
    neden: 'Sayfaya sitenin hicbir yerinden ic link gitmiyor. Tarayicilar sadece sitemap ile bulur, link degeri hic almaz.',
    nasil: 'Menuden, ilgili yazilardan veya kategori sayfasindan link ver.',
  },
  'giden-link-yok': {
    seviye: 'uyari', puana: false, baslik: 'Sayfadan cikan link yok',
    neden: 'Sayfa hicbir yere link vermiyor — link degeri sayfada sikisiyor ve tarayici oradan devam edemiyor.',
    nasil: 'Icerikten ilgili sayfalara en az birkac ic link ver.',
  },
  'schema-alan-eksik': {
    seviye: 'uyari', puana: true, baslik: 'Schema zorunlu alani eksik',
    neden: 'JSON-LD var ama Google\'in zengin sonuc icin bekledigi alan(lar) dolu degil. Schema teknik olarak gecerli olsa bile zengin sonuc cikmaz.',
    nasil: 'Eksik alani JSON-LD\'ye ekle ve Rich Results Test ile dogrula.',
  },
  'schema-yok': {
    seviye: 'uyari', puana: true, baslik: 'Gecerli schema yok',
    neden: 'Sitede JSON-LD yok veya gecersiz. Varliklarini (isletme, urun, makale) makine okuyamaz; hem zengin sonuc hem AI alintisi zorlasir.',
    nasil: 'En azindan Organization/LocalBusiness ekle; icerik tipine gore Article/Product/FAQPage ile genislet.',
  },

  // ---------- bilgi ----------
  'title-uzun': {
    seviye: 'bilgi', puana: false, baslik: 'Title cok uzun',
    neden: 'Arama sonucunda title kesiliyor; vaadin sonu kullaniciya hic gorunmuyor.',
    nasil: 'Onemli kelimeleri basa alarak 60 karakterin altina indir.',
  },
  'title-kisa': {
    seviye: 'bilgi', puana: false, baslik: 'Title cok kisa',
    neden: 'Cok kisa title alaka sinyali tasimaz ve sonuc listesinde yer kaplayamaz.',
    nasil: 'Ana konuyu ve ayirt edici detayi ekleyip 30 karakterin uzerine cikar.',
  },
  'description-uzun': {
    seviye: 'bilgi', puana: false, baslik: 'Meta description cok uzun',
    neden: 'Arama sonucunda ozet kesiliyor; cagri cumlesi gorunmeyebiliyor.',
    nasil: '160 karakterin altina indir, en onemli cumleyi basa al.',
  },
  'description-kisa': {
    seviye: 'bilgi', puana: false, baslik: 'Meta description cok kisa',
    neden: 'Cok kisa ozet sayfayi anlatmaz; Google kendi ozetini uretmeyi tercih edebilir.',
    nasil: '70-160 karakter araligina cikar, sayfanin ne vaat ettigini yaz.',
  },
  'baslik-atlama': {
    seviye: 'bilgi', puana: false, baslik: 'Baslik seviyesi atlaniyor',
    neden: 'H2\'den H4\'e atlamak gibi bosluklar belge hiyerarsisini bozar; ekran okuyucular ve alinti cikaran motorlar yapiyi yanlis kurar.',
    nasil: 'Basliklari sirayla kullan (H1 -> H2 -> H3). Seviye secimini gorsel buyukluk icin degil yapi icin yap.',
  },
  'yavas-yanit': {
    seviye: 'bilgi', puana: false, baslik: 'Yavas sunucu yaniti',
    neden: 'Sunucunun ilk bayti gec donuyor. Yavas yanit hem kullanici deneyimini hem tarama hizini dusurur.',
    nasil: 'Onbellek (cache), veritabani sorgulari ve barindirma planina bak; TTFB\'yi 600 ms altina cekmeyi hedefle.',
  },
  'noindex-sayfa': {
    seviye: 'bilgi', puana: false, baslik: 'Sayfa noindex',
    neden: 'Sayfa arama sonuclarina cikmayacak. Bilincli bir tercih olabilir; degilse gorunmez trafik kaybi demektir.',
    nasil: 'Sayfa indekslenmeliyse meta robots / X-Robots-Tag icindeki noindex\'i kaldir.',
  },
  'canonical-baskasina': {
    seviye: 'bilgi', puana: false, baslik: 'Canonical baska sayfayi gosteriyor',
    neden: 'Sayfa kendini degil baska bir URL\'yi asil surum ilan ediyor; bu sayfa indekslenmez.',
    nasil: 'Bilincliyse bir sey yapma. Degilse canonical\'i sayfanin kendi adresine cevir.',
  },
  'derin-sayfa': {
    seviye: 'bilgi', puana: false, baslik: 'Sayfa site yapisinda cok derinde',
    neden: 'Anasayfadan cok tiklama uzaklikta olan sayfalar hem daha az taranir hem daha az link degeri alir.',
    nasil: 'Onemli sayfalari menuye, kategori sayfalarina veya ilgili icerik bloklarina tasi — 3 tiklamayi hedefle.',
  },
  'robots-sozdizimi': {
    seviye: 'bilgi', puana: false, baslik: 'robots.txt sozdizimi hatasi',
    neden: 'Ayristirilamayan satirlar hicbir bota uygulanmaz; kural koydugunu sandigin yerde kural yok.',
    nasil: 'Hatali satiri duzelt; her kural bir User-agent grubunun altinda ve Allow/Disallow/Sitemap bicminde olmali.',
  },
  'llms-yok': {
    seviye: 'bilgi', puana: true, baslik: 'llms.txt yok',
    neden: 'AI motorlarinin siteyi dogru ozetlemesi icin kokte duran ozet dosyasi. Yoksa motor siteyi kendi tahminiyle tarif eder.',
    nasil: 'Panel -> Araclar bolumunden uretip site kokune (/llms.txt) koy.',
  },
};

// ---- yardimcilar ----
const SEVIYE_SIRA = { kritik: 0, uyari: 1, bilgi: 2 };

// Katalogda olmayan bir tip gelirse panel patlamasin: makul bir varsayilan don.
function sorunBilgi(tip) {
  return SORUN_KATALOG[tip] || { seviye: 'bilgi', puana: false, baslik: tip, neden: '', nasil: '' };
}

// crawl.js'in urettigi ham bulgu listesini seviyeye gore sirali, metinleri
// doldurulmus hale getirir. Panel ve rapor bunu dogrudan basar.
function sorunlariZenginlestir(bulgular) {
  return (bulgular || [])
    .map(b => {
      const k = sorunBilgi(b.tip);
      return { ...b, seviye: k.seviye, baslik: k.baslik, neden: k.neden, nasil: k.nasil, puana: k.puana };
    })
    .sort((a, b) => (SEVIYE_SIRA[a.seviye] - SEVIYE_SIRA[b.seviye]) || (b.adet - a.adet));
}

// Bir site listesinin sorunlarini tip bazinda toplar (portfoy gorunumu).
function sorunOzeti(siteListesi) {
  const harita = new Map();
  (siteListesi || []).forEach(s => {
    (s.sorunlar || []).forEach(b => {
      const k = harita.get(b.tip) || { tip: b.tip, adet: 0, siteler: [] };
      k.adet += b.adet;
      k.siteler.push({ id: s.id, ad: s.ad, adet: b.adet });
      harita.set(b.tip, k);
    });
  });
  return sorunlariZenginlestir([...harita.values()]);
}

Object.assign(globalThis, { SORUN_KATALOG, SEVIYE_SIRA, sorunBilgi, sorunlariZenginlestir, sorunOzeti });
