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
  'Kirik sayfa':2,'Yonlendirme':2,'Canonical':1,'Yinelenen meta':1,
  'Ince icerik':3,'Yinelenen icerik':3,'Engellenen sayfa':2,
  'Ic link':2,'Orphan':2,'CLS':2,'LCP':2,'Kelime firsati':2,'Kelime dususu':2,'Indeks':2,'Icerik':2,'Kanibalizasyon':2,'Icerik boslugu':2,
  'Hiz':3,'GEO':3
};
const EFOR_AD = { 1:'kolay', 2:'orta', 3:'zor' };

function oneriUret(s){
  const o = [];
  const ekle = (alan, oncelik, mesaj) => {
    const efor = EFOR[alan] || 2;
    o.push({ site:s.ad, siteId:s.id, alan, oncelik, mesaj, efor, etki:ETKI[oncelik], hizliKazanim: efor===1 && (oncelik==='kritik'||oncelik==='yuksek') });
  };
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
  (s.siralama||[]).forEach(k=>{
    if (k.pozisyon>=4 && k.pozisyon<=10 && (k.gosterim||0)>=500) ekle('Kelime firsati','yuksek', `"${k.kelime}" #${k.pozisyon} + yüksek gösterim — az itmeyle ilk 3'e girer.`);
    else if (k.pozisyon>=11 && k.pozisyon<=20) ekle('Kelime firsati','orta', `"${k.kelime}" #${k.pozisyon} (2. sayfa) — içeriği güçlendir.`);
    if (k.onceki && k.pozisyon>k.onceki) ekle('Kelime dususu','orta', `"${k.kelime}" ${k.onceki}→${k.pozisyon} düştü — incele.`);
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
  (s.icerikBoslugu||[]).forEach(g=> ekle('Icerik boslugu', g.hacim>=500?'yuksek':'orta', `"${g.kelime}" (~${g.hacim} gösterim) — içeriği güçlendir/yaz.`));
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
