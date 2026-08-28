// assets/oneri-motoru.js
// ONERI / DEGERLENDIRME MOTORU — panelin ve raporun ORTAK beyni.
//
// Bu dosya iki yerde birden calisir:
//   1) tarayici — index.html'de app.js'ten ONCE <script> ile yuklenir (global tanimlar).
//   2) Node     — scripts/rapor.js ve scripts/telegram.js `import` eder.
// Bu yuzden ne `export` ne `require` kullanir; sonunda globalThis'e yazar.
// Ikisi ayni kodu okusun diye boyle: panelde gorunen oneri ile rapordaki oneri
// asla birbirinden ayrilmasin.
//
// Saf fonksiyon: DOM, fetch, dosya sistemi YOK. Sadece veri girer, oneri cikar.

const ONCELIK_SIRA = { kritik: 0, yuksek: 1, orta: 2, dusuk: 3 };
const ETKI = { kritik: 4, yuksek: 3, orta: 2, dusuk: 1 };
const EFOR = {
  'SSL':1,'Kirik link':1,'Sitemap':1,'Meta':1,'Gorsel alt':1,'Olcum':1,'Schema':1,'AI bot':1,'llms.txt':1,'Schema alan':1,'Robots':1,
  'Tarama':2,
  'Kirik sayfa':2,'Yonlendirme':2,'Canonical':1,'Yinelenen meta':1,
  'Ince icerik':3,'Yinelenen icerik':3,'Engellenen sayfa':2,
  'Ic link':2,'Orphan':2,'CLS':2,'LCP':2,'Kelime firsati':2,'Kelime dususu':2,'Indeks':2,'Icerik':2,'Kanibalizasyon':2,'Icerik boslugu':2,
  'Hiz':3,'GEO':3
};
const EFOR_AD = { 1:'kolay', 2:'orta', 3:'zor' };

// Bir olcum tarihinin uzerinden kac gun gecti? Tarih yoksa/bozuksa null.
function gunGecti(tarih){
  if (!tarih) return null;
  const t = new Date(tarih); if (isNaN(t)) return null;
  return Math.floor((Date.now() - t.getTime()) / 86400000);
}

// Turkce ekler yuzunden kelime ile URL slug'i tam eslesmez ("klinikleri" vs "klinigi").
// Kaba kok yaklasimi: harfleri sadelestir, her kelimenin ilk 5 harfini al.
const TR_HARF = { 'ı':'i','ğ':'g','ü':'u','ş':'s','ö':'o','ç':'c' };
const sadelestir = (t) => (t||'').toLowerCase().replace(/[ıığüşöç]/g, c=>TR_HARF[c]||c).replace(/[^a-z0-9]+/g,'-');
const DOLGU = new Set(['icin','ile','nasil','nedir','ve','the','for','and','of','in','to','how','what','best','near','with','your']);

// Bu kelimeyi hedefleyen bir sayfa var mi? Varsa yolunu dondur.
function kelimeyiKarsilayanSayfa(kelime, yollar){
  const kokler = sadelestir(kelime).split('-').filter(p => p.length>=4 && !DOLGU.has(p)).map(p => p.slice(0,5));
  if (!kokler.length) return null;
  for (const yol of (yollar||[])) {
    const y = sadelestir(yol);
    if (kokler.every(k => y.includes(k))) return yol;
  }
  return null;
}

// Pozisyon bir ORTALAMADIR. Az gosterimli bir kelimede tek bir dusuk gosterim 28 gunluk
// ortalamayi basamaklarca kaydirir; bu bir siralama kaybi degil, olcum gurultusudur.
// Anlamli sayilacak en kucuk dusus, veri hacmiyle ters orantili olsun:
//   gosterim 10 -> 10 basamak · 27 -> 6 · 100 -> 3 · 200 -> 3
const anlamliDusus = (gosterim) => Math.max(3, Math.ceil(30 / Math.sqrt(Math.max(gosterim||0, 1))));
// Firsatin degeri gosterimle orantili. Eski 500 esigi bu portfoyde hicbir kelimede
// tutmuyordu -> her firsat 'orta' cikip listeyi doldurup onceligi anlamsizlastiriyordu.
const hacimOncelik = (g) => (g >= 100 ? 'yuksek' : g >= 25 ? 'orta' : 'dusuk');

function oneriUret(s){
  const o = [];
  const ekle = (alan, oncelik, mesaj) => {
    const efor = EFOR[alan] || 2;
    o.push({ site:s.ad, siteId:s.id, alan, oncelik, mesaj, efor, etki:ETKI[oncelik], hizliKazanim: efor===1 && (oncelik==='kritik'||oncelik==='yuksek') });
  };
  // Tarama saglik kontrolunden gecemediyse asagidaki TUM bulgular son basarili
  // taramadan gelir. Bunu ilk siraya koy; yoksa bayat veriyle is yapilir.
  if (s.taramaHatasi) {
    // crawl.js kanit bulduysa (challenge sayfasi dogrudan goruldu) tahmin yurutme:
    // hangi urunun engelledigini ve gecis anahtarinin gonderilip gonderilmedigini yaz.
    const e = s.taramaHatasi.engel;
    const sebep = e
      ? `${e.saglayici} bot doğrulaması (${(e.nerede||[]).join(', ')}) — geçiş anahtarı ${e.anahtarGonderildi ? 'gönderildi ama işe yaramadı: Cloudflare Skip kuralı eksik/yanlış' : 'gönderilmedi: SEOTAKIP_ANAHTAR tanımsız'}.`
      : 'Muhtemel sebep: WAF/bot doğrulaması.';
    ekle('Tarama','kritik',
      `Son tarama engellendi (${(s.taramaHatasi.tarih||'').slice(0,10)}) — bu sitedeki diğer bulgular son başarılı taramadan. ${sebep} Teşhis için: npm run waf-tani`);
  }
  // Olcum TAZELIGI. GSC/PageSpeed/indeks adimlari CI'da sessizce atlanabiliyor
  // (`node scripts/searchconsole.js || echo ...`). Adim atlaninca crawl.js eski blogu
  // _<alan>Gercek bayragiyla oldugu gibi tasir; panel bayat sayiyi taze gibi gosterir.
  // Bayrak "bir zamanlar gercekti" demek, "guncel" demek degil -> tarihine bakip soyle.
  [
    ['Search Console (sıralama + içerik boşluğu)', s.siralamaTarih,    (s.siralama||[]).length > 0, 4,  'kelime fırsatı/düşüşü ve içerik boşluğu'],
    ['PageSpeed (hız)',                            s.hizTarih,         !!s.hiz,                    10, 'hız/LCP/CLS'],
    ['İndeks denetimi',                            s.indeks?.tarih,    !!s.indeks,                 10, 'indeks'],
    ['GEO (AI motor görünürlüğü)',                 s.geoTarih,         !!s.geo,                    30, 'GEO'],
  ].forEach(([ad, tarih, veriVar, esik, etkilenen]) => {
    if (!veriVar) return;
    const gun = gunGecti(tarih);
    // "Tarihi bilmiyoruz" ile "12 gundur bayat" ayni sey degil; ilki daha zayif bir sinyal.
    if (gun == null)
      ekle('Olcum','dusuk', `${ad} verisinin ölçüm tarihi yok — ne zaman alındığı bilinmiyor, güncel sayma. Bir kez yenile, damga otomatik düşecek.`);
    else if (gun > esik)
      ekle('Olcum', gun > esik*2 ? 'yuksek' : 'orta',
        `${ad} verisi ${gun} gündür yenilenmedi (son ölçüm: ${String(tarih).slice(0,10)}) — aşağıdaki ${etkilenen} maddeleri o günün fotoğrafı, bugünün durumu değil. İlgili adım hata veriyor olabilir.`);
  });
  if (s.ssl && !s.ssl.gecerli) ekle('SSL','kritik','SSL yok/geçersiz — hemen kur.');
  else if (s.ssl && s.ssl.kalanGun<=30) ekle('SSL', s.ssl.kalanGun<=14?'kritik':'yuksek', `SSL ${s.ssl.kalanGun} gün sonra doluyor — yenile.`);
  const ko = s.kirikOzet||{};
  if (ko.ic) ekle('Kirik link','yuksek', `${ko.ic} kırık İÇ link — kendi sayfalarına 404 veriyor, düzelt veya yönlendir.`);
  if (ko.dis) ekle('Kirik link','dusuk', `${ko.dis} kırık dış link — hedef site kapanmış, linki kaldır.`);
  if (ko.dogrulanmamis) ekle('Kirik link','dusuk', `${ko.dogrulanmamis} link geçici hata verdi (henüz doğrulanmadı, puana yansımıyor).`);
  if (!s.schema?.gecerli) ekle('Schema','orta','JSON-LD schema yok — LocalBusiness/Organization ekle.');
  else if (s.schema?.sorunluSayfa) {
    const ilk = (s.schema.eksikAlan||[])[0];
    ekle('Schema alan','yuksek', `${s.schema.sorunluSayfa} sayfada schema alanı eksik${ilk?` (en yaygını: ${ilk.alan}, ${ilk.adet} sayfa)`:''} — zengin sonuç çıkmaz.`);
  }
  if (s.icerik?.inceSayfa) ekle('Ince icerik', s.icerik.inceSayfa >= (s.sayfalar?.taranan||0)/2 ? 'yuksek':'orta',
    `${s.icerik.inceSayfa} sayfa ${s.icerik.esik} kelimenin altında (ort. ${s.icerik.ortKelime}) — içeriği derinleştir.`);
  if (s.llms && !s.llms.varMi) ekle('llms.txt','orta','llms.txt yok — Araçlar sekmesinden üretip köke koy.');
  // robots.txt govdesi (crawl.js ayristiriyor): AI bot erisimi + sozdizimi + engelli sayfa
  const rb = s.robots || {};
  if (rb.bizeKapali) ekle('Robots','kritik','robots.txt taramayı tamamen engelliyor — denetim yapılamıyor, kuralı gevşet.');
  if (rb.sorun) ekle('Robots','orta', `robots.txt'te ${rb.hatalar?.length||0} sözdizimi hatası (satır ${(rb.hatalar||[]).map(h=>h.satirNo).join(', ')}) — o satırlar hiçbir bota uygulanmıyor.`);
  if (rb.engelliAi) {
    const kapali = (rb.botlar||[]).filter(b=>b.ai && !b.izin);
    ekle('AI bot', rb.engelliAi >= (rb.toplamAi||1)/2 ? 'yuksek' : 'orta',
      `${rb.engelliAi}/${rb.toplamAi} AI botu robots.txt ile engelli (${kapali.slice(0,3).map(b=>b.ad).join(', ')}${kapali.length>3?'…':''}) — bu motorlar seni kaynak gösteremez. Bilinçli tercihse yok say.`);
  }
  if (rb.aiSinyal && rb.aiSinyal['ai-train'] === 'no')
    ekle('AI bot','dusuk','robots.txt\'te Content-Signal ai-train=no — model eğitimine kapalısın (arama/alıntı etkilenmez).');
  if (s.sayfaDurum?.kirik) ekle('Kirik sayfa','yuksek', `${s.sayfaDurum.kirik} sayfa taramada hata verdi (404/5xx) — sitemap'te duruyor ama açılmıyor.`);
  if (s.sayfaDurum?.yonlendirme) ekle('Yonlendirme','dusuk', `${s.sayfaDurum.yonlendirme} sayfa yönlendiriliyor — sitemap/iç linkleri son adrese güncelle.`);
  if (!s.sitemap?.varMi) ekle('Sitemap','yuksek','sitemap.xml yok — oluştur ve Search Console\'a gönder.');
  else if (s.sitemap.erisilemez>0) ekle('Sitemap','orta', `Sitemap'te ${s.sitemap.erisilemez} erişilemez URL — temizle.`);
  const em = s.eksikMeta||{}; const meta = (em.title||0)+(em.description||0)+(em.h1||0);
  if (meta) ekle('Meta','orta', `${meta} sayfada eksik title/description/H1 — doldur.`);
  const op = s.onpage||{};
  if (op.altEksik>10) ekle('Gorsel alt','dusuk', `${op.altEksik} görselde alt text yok — ekle.`);
  if (!op.tracking?.length) ekle('Olcum','orta','GA4/GTM yok — trafiği ölçemezsin, kur.');
  if (op.keywordYogunluk==='dusuk') ekle('Icerik','dusuk','Anahtar kelime yoğunluğu düşük — konu derinliğini artır.');
  const h = s.hiz||{};
  if (h.mobilPuan!=null && h.mobilPuan<50) ekle('Hiz','yuksek', `Mobil hız ${h.mobilPuan}/100 — kritik. Görsel/JS optimize et.`);
  else if (h.mobilPuan!=null && h.mobilPuan<90) ekle('Hiz','dusuk', `Mobil hız ${h.mobilPuan}/100 — iyileştir.`);
  if (h.cls>0.25) ekle('CLS','orta', `CLS ${h.cls} yüksek — layout kayması var, boyut ver.`);
  if (h.lcp>4) ekle('LCP','orta', `LCP ${h.lcp}s yavaş — en büyük görseli optimize et / preload.`);
  const ic = s.iclink||{};
  if (ic.ortLink!=null && ic.ortLink<5) ekle('Ic link','orta', `Ortalama ${ic.ortLink} iç link/sayfa — AZ. En az 5-8 hedefle.`);
  if (ic.orphan?.length) ekle('Orphan','orta', `${ic.orphan.length} öksüz sayfa — menü/ilgili yazılardan link ver.`);
  if (s.indeks?.dususVar) ekle('Indeks','yuksek','İndekslenen sayfa düştü — Search Console kapsam hatalarına bak.');
  // Sadece AKSIYON GEREKTIREN nedenler oneri uretir. "Alternatif sayfa"/"yonlendirme" gibi
  // normal durumlar indekssiz sayilir ama yapilacak bir sey yoktur -> oneri cikarmaz.
  (s.indeks?.nedenler||[]).filter(n=>n.sorun).forEach(n=>{
    const onc = /404|5xx|robots|401|403/.test(n.neden) ? 'yuksek' : n.adet>=5 ? 'orta' : 'dusuk';
    ekle('Indeks', onc, `${n.adet} sayfa: ${n.neden} — ${n.cozum||'Search Console → URL Denetleme ile incele.'}`);
  });
  if (s.aiBotlar){ const b=s.aiBotlar; if (((b.gptbot||0)+(b.claudebot||0)+(b.perplexitybot||0))<20) ekle('AI bot','orta','AI botları siteni az tarıyor — llms.txt ekle, robots\'ta izin ver.'); }
  if (s.geo && !s.geo.chatgpt && !s.geo.perplexity && !s.geo.gemini && !s.geo.claude) ekle('GEO','orta','Hiçbir AI motorunda görünmüyorsun — schema + net cevap formatlı içerik gerek.');
  // Ayni kelime hem burada hem icerikBoslugu listesinde cikabiliyor (ikisi de GSC kaynakli,
  // araliklar cakisiyor) -> asagida mukerrer madde uretmemek icin isaretle.
  const firsatKelimeler = new Set();
  // Bu kelime icin YENI yayinlanmis bir sayfa var mi? Varsa siralama daha oturmamistir:
  // GSC 28 gunluk ortalama verir, yayin oncesi gunler de o ortalamanin icindedir.
  // {sayfa, yas} dondurur; yoksa null.
  const yeniSayfa = (kelime) => {
    const yol = kelimeyiKarsilayanSayfa(kelime, s.sayfaYollari);
    if (!yol) return null;
    const yas = gunGecti(s.sayfaTarih?.[yol]);
    return (yas != null && yas < 45) ? { yol, yas } : null;
  };
  (s.siralama||[]).forEach(k=>{
    const gos = k.gosterim || 0;
    if (k.pozisyon>=4 && k.pozisyon<=10 && gos>=100) {
      firsatKelimeler.add(k.kelime);
      ekle('Kelime firsati','yuksek', `"${k.kelime}" #${k.pozisyon} + ${gos} gösterim — az itmeyle ilk 3'e girer.`);
    } else if (k.pozisyon>=11 && k.pozisyon<=20) {
      firsatKelimeler.add(k.kelime);
      const yeni = yeniSayfa(k.kelime);
      if (yeni) ekle('Kelime firsati','dusuk', `"${k.kelime}" #${k.pozisyon} — ${yeni.yol} ${yeni.yas} gün önce yayınlandı, 28 günlük ortalama hâlâ yayın öncesini kapsıyor. Sıralama oturmadı, bekle.`);
      else ekle('Kelime firsati', hacimOncelik(gos), `"${k.kelime}" #${k.pozisyon} (2. sayfa, ${gos} gösterim) — içeriği güçlendir.`);
    }
    // Dusus: sadece ulasilabilir mesafede (ilk 3 sayfa) ve olcum gurultusunden BUYUKSE.
    // 81→88 gibi hareketler ya da 10 gosterimlik bir kelimedeki 5 basamak, sinyal degil.
    const dusus = k.onceki ? k.pozisyon - k.onceki : 0;
    if (dusus > 0 && k.pozisyon<=30 && dusus >= anlamliDusus(gos))
      ekle('Kelime dususu','orta', `"${k.kelime}" ${k.onceki}→${k.pozisyon} düştü (${gos} gösterim) — incele.`);
  });
  // ---- crawl.js'in sorun listesinden gelen YENI bulgular ----
  // Yukaridaki kurallarin ZATEN kapsadigi tipler (title-yok, ince-icerik, kirik-ic-link...)
  // burada YOK; iki kez oneri uretmesinler. Sadece yeni kontroller listelenir.
  const SORUN_ONERI = {
    'engellenen-sayfa':    ['yuksek','Engellenen sayfa', a=>`${a} sayfa bot doğrulaması/403 döndü — denetlenemedi. WAF'ta kendi tarayıcına izin ver.`],
    'sunucu-hatasi':       ['yuksek','Kirik sayfa',      a=>`${a} sayfa 5xx veriyor — sunucu logunu incele, tekrarlarsa Google indeksten düşürür.`],
    'yonlendirme-dongusu': ['yuksek','Yonlendirme',      a=>`${a} URL yönlendirme döngüsünde — sayfa hiç açılmıyor, kuralları çakışıyor.`],
    'yinelenen-icerik':    ['orta',  'Yinelenen icerik', a=>`${a} sayfa aynı gövde metnini sunuyor — birini asıl yap, diğerlerine canonical ver.`],
    'yinelenen-title':     ['orta',  'Yinelenen meta',   a=>`${a} sayfa aynı title'ı paylaşıyor — sayfalar birbiriyle yarışıyor.`],
    'canonical-cakismasi': ['orta',  'Canonical',        a=>`${a} sayfada çelişkili canonical sinyali — Google ikisini de yok sayabilir.`],
    'yavas-yanit':         ['orta',  'Hiz',              a=>`${a} sayfa yavaş yanıt veriyor — TTFB'yi düşür (cache/hosting).`],
    'yinelenen-description':['dusuk','Yinelenen meta',   a=>`${a} sayfa aynı meta description'ı paylaşıyor — arama sonucunda ayırt edilemiyorlar.`],
    'yonlendirme-zinciri': ['dusuk', 'Yonlendirme',      a=>`${a} URL birden fazla adımda yönleniyor — iç link ve sitemap'i son adrese güncelle.`],
    'coklu-h1':            ['dusuk', 'Meta',             a=>`${a} sayfada birden fazla H1 — tek H1 bırak, diğerlerini H2 yap.`],
    'giden-link-yok':      ['dusuk', 'Ic link',          a=>`${a} sayfadan hiç iç link çıkmıyor — link değeri orada sıkışıyor.`],
    'derin-sayfa':         ['dusuk', 'Ic link',          a=>`${a} sayfa 3 tıklamadan derinde — önemli olanları menüye/kategoriye taşı.`],
    'baslik-atlama':       ['dusuk', 'Meta',             a=>`${a} sayfada başlık seviyesi atlanıyor (ör. H2→H4) — hiyerarşiyi sırayla kur.`],
    'title-uzun':          ['dusuk', 'Meta',             a=>`${a} sayfada title 60 karakteri aşıyor — arama sonucunda kesiliyor.`],
    'title-kisa':          ['dusuk', 'Meta',             a=>`${a} sayfada title 30 karakterin altında — alaka sinyali zayıf.`],
    'description-uzun':    ['dusuk', 'Meta',             a=>`${a} sayfada description 160 karakteri aşıyor — özet kesiliyor.`],
    'description-kisa':    ['dusuk', 'Meta',             a=>`${a} sayfada description 70 karakterin altında — sayfayı anlatmıyor.`],
  };
  (s.sorunlar||[]).forEach(b=>{
    const k = SORUN_ONERI[b.tip]; if (!k || !b.adet) return;
    const [oncelik, alan, metin] = k;
    ekle(alan, oncelik, metin(b.adet));
  });

  (s.kanibalizasyon||[]).forEach(k=> ekle('Kanibalizasyon','orta', `"${k.kelime}" için ${k.sayfalar.length} sayfa yarışıyor — birini ana yap, diğerlerini birleştir.`));
  // icerikBoslugu Search Console'dan gelir (pozisyon 8-50 + gosterim var) ve "bu kelime
  // icin sayfa var mi" bilgisini TASIMAZ. Sayfalara bakmadan "yaz" demek, yeni yayinlanmis
  // icerigi yokmus gibi gosteriyordu: 28 gunluk ortalama yayin ONCESI donemi de kapsadigi
  // icin taze sayfa dogal olarak hala geride gorunur.
  (s.icerikBoslugu||[]).forEach(g=>{
    if (firsatKelimeler.has(g.kelime)) return;   // ayni kelime yukarida "Kelime firsati" olarak cikti
    const hacim = g.hacim || 0;
    const sayfa = kelimeyiKarsilayanSayfa(g.kelime, s.sayfaYollari);
    if (!sayfa) {
      ekle('Icerik boslugu', hacimOncelik(hacim), `"${g.kelime}" (~${hacim} gösterim, #${g.rakipPoz}) — bu kelimeyi hedefleyen sayfa yok, yaz.`);
      return;
    }
    const yeni = yeniSayfa(g.kelime);
    if (yeni)
      ekle('Icerik boslugu','dusuk', `"${g.kelime}" için ${yeni.yol} ${yeni.yas} gün önce yayınlandı — GSC'nin 28 günlük ortalaması hâlâ yayın öncesini kapsıyor, sıralama oturmadı. Yeni içerik yazma, bekle.`);
    else
      ekle('Icerik boslugu', hacimOncelik(hacim), `"${g.kelime}" (~${hacim} gösterim, #${g.rakipPoz}) — sayfa var (${sayfa}), yenisini yazma: başlık/H1'de kelimeyi kullan ve iç link ver.`);
  });
  return o;
}

// site listesi -> oncelige gore sirali tek oneri listesi
const onerileriTopla = (siteListesi)=> (siteListesi||[]).flatMap(oneriUret)
  .sort((a,b)=> ONCELIK_SIRA[a.oncelik]-ONCELIK_SIRA[b.oncelik]);

// Haftalik akilli ozet metni. Panelde de raporda da AYNI cumleler ciksin diye burada.
function haftalikOzet(siteListesi, oneriListesi, degisiklikler, ortalamaSeoPuan){
  const t = oneriListesi || onerileriTopla(siteListesi);
  const k = t.filter(o=>o.oncelik==='kritik').length, y = t.filter(o=>o.oncelik==='yuksek').length, hizli = t.filter(o=>o.hizliKazanim).length;
  const deg = degisiklikler||[];
  const artis = deg.filter(d=>d.tip==='artis'), dusus = deg.filter(d=>d.tip==='dusus'||d.tip==='yeni-kirik');
  let s = `Bu hafta ${(siteListesi||[]).length} site takip edildi; ortalama SEO puanı ${ortalamaSeoPuan}/100. `;
  s += k ? `${k} kritik ve ${y} yüksek öncelikli sorun var — önce bunları kapat. ` : `Kritik sorun yok; ${y} yüksek öncelikli madde var. `;
  if(hizli) s += `${hizli} adet hızlı kazanım (yüksek etki, kolay) var. `;
  if(artis.length) s += `Olumlu: ${artis.map(a=>a.mesaj).join('; ')}. `;
  if(dusus.length) s += `Dikkat: ${dusus.map(a=>a.mesaj).join('; ')}. `;
  const ilk3 = t.slice(0,3).map(a=>`(${a.site}) ${a.mesaj}`).join('  |  ');
  if(ilk3) s += `Önerilen ilk 3 aksiyon: ${ilk3}`;
  return s;
}

Object.assign(globalThis, { ONCELIK_SIRA, ETKI, EFOR, EFOR_AD, oneriUret, onerileriTopla, haftalikOzet });
