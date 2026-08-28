// SEO/GEO Nöbet Paneli — cizim katmani (mekanik/kontrol-odasi temasi)
// Tek veri kaynagi: data/data.json (file:// ise assets/fallback-data.js).

const el = (id) => document.getElementById(id);
let VERI = null, AKTIF = 'genel', ARAMA = '', SECILI_SITE = '';

// ---- menu (gruplu) ----
const MENU_GRUPLARI = [
  { grup: 'Genel', items: [
    { id:'genel', ad:'Genel Bakış', ik:'▣' },
    { id:'saglik', ad:'Site Sağlığı', ik:'◍' },
    { id:'oneri', ad:'Öneriler', ik:'★' },
    { id:'siteler', ad:'Siteler', ik:'❏' },
    { id:'degisim', ad:'Değişiklik İzleyici', ik:'⇄' },
    { id:'uyarilar', ad:'Uyarılar', ik:'!' },
  ]},
  { grup:'Teknik SEO', items:[
    { id:'sorunlar', ad:'Sorunlar', ik:'⚑' },
    { id:'denetim', ad:'SEO Denetim', ik:'✓' },
    { id:'kirik', ad:'Kırık Linkler', ik:'⚿' },
    { id:'hiz', ad:'Hız / Core Vitals', ik:'⚡' },
    { id:'iclink', ad:'İç Linkleme', ik:'⋔' },
    { id:'indeks', ad:'İndeks Monitörü', ik:'⊞' },
  ]},
  { grup:'İçerik & Sıralama', items:[
    { id:'kelime', ad:'Anahtar Kelime', ik:'#' },
    { id:'gap', ad:'İçerik Boşluğu', ik:'◫' },
    { id:'rakip', ad:'Rakip Analizi', ik:'⚔' },
    { id:'icerik', ad:'AI İçerik / Blog', ik:'✎' },
  ]},
  { grup:'GEO / AI', items:[
    { id:'geo', ad:'GEO Görünürlük', ik:'◎' },
    { id:'botlar', ad:'AI Bot Takibi', ik:'⟲' },
  ]},
  { grup:'Çıktı', items:[
    { id:'raporlar', ad:'Raporlar', ik:'▤' },
    { id:'araclar', ad:'Araçlar', ik:'⚒' },
    { id:'ayarlar', ad:'Ayarlar', ik:'⚙' },
  ]},
];
const MENU = MENU_GRUPLARI.flatMap(g => g.items);
const FILTRELI = new Set(['genel','saglik','oneri','siteler','sorunlar','denetim','kirik','hiz','iclink','indeks','kelime','gap','rakip','geo','botlar','uyarilar']);
// Sorunlar bolumunun seviye filtresi ('' = hepsi). git() cizimi tekrar cagirdigi icin
// modul duzeyinde tutuluyor; SECILI_SITE ile ayni desen.
let SORUN_SEVIYE = '';

// ============ TON / RENK ============
const puanTon = (p)=> p>=80?'ok':p>=65?'warn':'bad';
const puanRenk = (p)=> ({ok:'#3FCE7C',warn:'#F5B23B',bad:'#F0607A'}[puanTon(p)]);
const posTon = (p)=> p==null?'mut':p<=10?'ok':p<=20?'warn':'bad';
const hizTon = (h)=> h==null?'mut':h>=90?'ok':h>=50?'warn':'bad';
const linkTon = (k)=> k===0?'ok':'bad';
const kisaUrl = (u)=> (u||'').replace(/^https?:\/\//,'');

// ============ BILESEN YARDIMCILARI ============
function cip(metin, tip=''){ return `<span class="cip ${tip}">${metin}</span>`; }
const durumCip = (ok, iyi, kotu)=> ok ? cip(iyi,'ok') : cip(kotu,'bad');

function sslCip(ssl){
  if(!ssl?.gecerli) return cip('SSL yok','bad');
  const g = ssl.kalanGun;
  return cip('SSL '+g+'g', g<=14?'bad':g<=30?'warn':'ok');
}

function kadran(puan, boyut=92){
  const r = boyut*0.36, C = 2*Math.PI*r, off = C*(1-(puan??0)/100);
  const tickR = boyut*0.445, c = boyut/2, sw = boyut*0.076;
  const fs = Math.round(boyut*0.33), ls = Math.round(boyut*0.10);
  return `<span class="skor" style="width:${boyut}px;height:${boyut}px">
    <svg width="${boyut}" height="${boyut}" viewBox="0 0 ${boyut} ${boyut}">
      <circle cx="${c}" cy="${c}" r="${tickR.toFixed(1)}" fill="none" stroke="#2b3a5a" stroke-width="1.5" stroke-dasharray="1.1 7" stroke-linecap="round"/>
      <circle cx="${c}" cy="${c}" r="${r.toFixed(1)}" fill="none" stroke="#1d2740" stroke-width="${sw.toFixed(1)}"/>
      <circle cx="${c}" cy="${c}" r="${r.toFixed(1)}" fill="none" stroke="${puanRenk(puan)}" stroke-width="${sw.toFixed(1)}" stroke-linecap="round"
        stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${c} ${c})"/>
    </svg>
    <span class="v"><b style="font-size:${fs}px">${puan??'–'}</b><s style="font-size:${ls}px">skor</s></span>
  </span>`;
}

// tematik halka: kadranin kucuk kardesi. puan null ise "olculmedi" (kesik gri cember).
function halka(puan, boyut=62){
  const r = boyut*0.38, C = 2*Math.PI*r, c = boyut/2, sw = boyut*0.10;
  const olculmedi = puan==null;
  const off = C*(1-(puan??0)/100);
  const iz = olculmedi
    ? `<circle cx="${c}" cy="${c}" r="${r.toFixed(1)}" fill="none" stroke="#2b3a5a" stroke-width="${sw.toFixed(1)}" stroke-dasharray="3 5"/>`
    : `<circle cx="${c}" cy="${c}" r="${r.toFixed(1)}" fill="none" stroke="#1d2740" stroke-width="${sw.toFixed(1)}"/>
       <circle cx="${c}" cy="${c}" r="${r.toFixed(1)}" fill="none" stroke="${puanRenk(puan)}" stroke-width="${sw.toFixed(1)}" stroke-linecap="round"
         stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${c} ${c})"/>`;
  return `<span class="skor" style="width:${boyut}px;height:${boyut}px">
    <svg width="${boyut}" height="${boyut}" viewBox="0 0 ${boyut} ${boyut}">${iz}</svg>
    <span class="v"><b style="font-size:${Math.round(boyut*0.30)}px;color:${olculmedi?'var(--faint)':'var(--text)'}">${olculmedi?'–':puan}</b></span></span>`;
}

const mt = (label, val, unit, ton='')=> `<div class="mt"><div class="ml">${label}</div><div class="mv ${ton?'t-'+ton:''}">${val}${unit?`<small>${unit}</small>`:''}</div></div>`;

function karo(baslik, deger, alt, ton){
  return `<div class="karo"><div class="kl">${baslik}</div><div class="kv ${ton?'t-'+ton:''}">${deger}</div><div class="ks">${alt||''}</div></div>`;
}

function tbadge(trend){
  if(!trend || trend==='+0' || trend==='0') return `<span class="tbadge" style="background:#16203a;color:var(--muted)">– sabit</span>`;
  const up = trend.startsWith('+');
  const c = up?'var(--ok)':'var(--bad)', bg = up?'var(--ok-dim)':'var(--bad-dim)';
  return `<span class="tbadge" style="background:${bg};color:${c}">${up?'▲':'▼'} SEO ${trend}</span>`;
}

// Tarama saglik kontrolunden gecemeyen site: ekrandaki her sey SON BASARILI
// taramadan geliyor. Kullanici bunu bilmeden karar vermesin diye her yerde ayni rozet.
function taramaRozeti(s, kisa){
  if(!s?.taramaHatasi) return '';
  const t = (s.taramaHatasi.tarih||'').slice(0,10);
  const ip = `${s.taramaHatasi.tarih ? t+' taramasi engellendi' : 'tarama engellendi'} — ${(s.taramaHatasi.neden||[]).map(n=>n.mesaj).join(' · ')}`;
  const kacir = (v)=> String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  return `<span class="tbadge" title="${kacir(ip)}" style="background:var(--bad-dim);color:var(--bad)">⚠ ${kisa?'bayat':'tarama başarısız — veriler '+t+' öncesinden'}</span>`;
}

function bolumBaslik(eyebrow, baslik, aciklama){
  return `<div class="bolum-baslik"><div class="eyebrow">${eyebrow}</div><h2>${baslik}</h2><p>${aciklama}</p></div>`;
}
const bosDurum = (m)=> `<div class="bos">${m}</div>`;
const asamaRozeti = (n)=> `<span class="asama">Aşama ${n}</span>`;
// Search Console verisi ne zaman cekildi? Damga yoksa/bayatsa tablo basliginda soyle —
// pozisyon 28 GUNLUK ORTALAMA'dir, tarihi gormeden okunursa bugunun siralamasi sanilir.
const olcumNotu = (s)=>{
  if (!s.siralamaTarih) return ' <span style="font-size:11px;color:var(--faint);font-weight:400">· ölçüm tarihi bilinmiyor</span>';
  const gun = Math.floor((Date.now() - new Date(s.siralamaTarih).getTime())/86400000);
  const pen = s.siralamaPencere ? `${s.siralamaPencere.baslangic} → ${s.siralamaPencere.bitis}` : '28 gün';
  const bayat = gun > 4;
  return ` <span style="font-size:11px;font-weight:400;color:var(--${bayat?'warn':'faint'})">· ${pen} ortalaması${bayat?` · ${gun} gündür yenilenmedi`:''}</span>`;
};
const stBaslik = (baslik, sayi, more)=> `<div class="st"><h3>${baslik}</h3>${sayi!=null?`<span class="count">${sayi}</span>`:''}${more?`<button class="more" onclick="${more}">tümü →</button>`:''}</div>`;

// site filtresi
function filtreBar(){
  const c = (id,ad)=>`<button class="fcip ${SECILI_SITE===id?'aktif':''}" onclick="siteSec('${id}')">${ad}</button>`;
  return `<div class="filtre"><span class="fl">Site</span>${c('','Tümü')}${(VERI.siteler||[]).map(s=>c(s.id,s.ad)).join('')}</div>`;
}
function siteSec(id){ SECILI_SITE = id; git(AKTIF); }
window.siteSec = siteSec;
function sorunSeviye(sv){ SORUN_SEVIYE = sv; git(AKTIF); }
window.sorunSeviye = sorunSeviye;

// Sorun listesini CSV olarak indirir. Excel'in ayraci dogru secmesi icin BOM + ";" kullanilir
// (TR yerelinde virgul ondalik ayracidir; virgulle ayrilmis dosya tek sutuna dusuyor).
function sorunCsv(){
  const list = siteler();
  const satirlar = [];
  list.forEach(s => sorunlariZenginlestir(s.sorunlar||[])
    .filter(b => !SORUN_SEVIYE || b.seviye===SORUN_SEVIYE)
    .forEach(b => satirlar.push([
      s.id, s.ad, b.seviye, b.tip, b.baslik, b.adet, b.puana?'evet':'hayir',
      (b.ornekler||[]).map(o=>o.deger?`${o.yol} (${o.deger})`:o.yol).join(' | '),
      b.nasil,
    ])));
  if(!satirlar.length){ alert('Dışa aktarılacak bulgu yok.'); return; }
  const basliklar = ['site_id','site','seviye','tip','baslik','adet','puana_giriyor','ornekler','nasil_duzeltilir'];
  const kacir = (v)=> `"${String(v??'').replace(/"/g,'""')}"`;
  const csv = '﻿' + [basliklar, ...satirlar].map(r=>r.map(kacir).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  a.download = `seotakip-sorunlar-${(VERI.guncelleme||'').slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}
window.sorunCsv = sorunCsv;

const siteler = ()=> (VERI?.siteler||[]).filter(s =>
  (!SECILI_SITE || s.id===SECILI_SITE) && (!ARAMA || (s.ad+s.url).toLowerCase().includes(ARAMA)));

// ============ ÖNERİ / DEĞERLENDİRME MOTORU ============
// Motorun kendisi assets/oneri-motoru.js'te (index.html'de bu dosyadan ONCE yuklenir).
// Ayni motoru scripts/rapor.js de kullanir; panel ile rapor asla ayrisamasin diye.
// Buradan gelen globaller: ONCELIK_SIRA, ETKI, EFOR, EFOR_AD, oneriUret, onerileriTopla, haftalikOzet

const tumOneriler = ()=> onerileriTopla(siteler());
const icLinkYorum = (n)=> n==null?{metin:'–',ton:'mut'} : n<5?{metin:'AZ',ton:'warn'} : n<=15?{metin:'ideal',ton:'ok'} : {metin:'ÇOK',ton:'warn'};

// ============ MANUEL RAKİP (localStorage) ============
const RAKIP_KEY = 'seotakip_rakipler_v1';
const rakipEkGetir = ()=> { try{ return JSON.parse(localStorage.getItem(RAKIP_KEY))||{}; }catch{ return {}; } };
const rakipEkKaydet = (o)=> localStorage.setItem(RAKIP_KEY, JSON.stringify(o));
function rakipEkle(){
  const siteId = el('rk-site').value, kelime = el('rk-kelime').value.trim();
  const ad = el('rk-ad').value.trim().replace(/^https?:\/\//,'').replace(/\/.*$/,'');
  if(!kelime||!ad){ alert('Anahtar kelime ve rakip alan adı gerekli.'); return; }
  const st = rakipEkGetir(); (st[siteId]=st[siteId]||[]).push({ad,kelime,biz:null,rakipPoz:null,manuel:true});
  rakipEkKaydet(st); git('rakip');
}
function rakipSil(siteId, i){ const s=rakipEkGetir(); if(s[siteId]){ s[siteId].splice(i,1); rakipEkKaydet(s); git('rakip'); } }
window.rakipEkle = rakipEkle; window.rakipSil = rakipSil;

// ============ ARAÇ ÜRETİCİLER ============
let ARAC_SITE = null;
const aracSite = ()=> (VERI?.siteler||[]).find(s=>s.id===ARAC_SITE) || (VERI?.siteler||[])[0];
function aracDegis(){ ARAC_SITE = el('arac-site').value; git('araclar'); }
window.aracDegis = aracDegis;
const uretLlms = (s)=> `# ${s.ad}\n> ${s.ad} — ${kisaUrl(s.url)} resmi sitesi.\n\n## Hakkında\n- Site: ${s.url}\n- Diller: ${(s.diller||['tr']).join(', ')}\n\n## Önemli sayfalar\n- [Ana sayfa](${s.url})\n- [Hizmetler](${s.url}/hizmetler)\n- [İletişim](${s.url}/iletisim)\n`;
const uretRobots = (s)=> `# ${s.ad} — AI bot erişimi (robots.txt'e ekle)\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: ChatGPT-User\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /\n\nSitemap: ${s.url}/sitemap.xml\n`;
const uretSchema = (s)=> JSON.stringify({ "@context":"https://schema.org","@type":"LocalBusiness","name":s.ad,"url":s.url,"image":s.url+"/logo.png","telephone":"+90 ___ ___ __ __","address":{"@type":"PostalAddress","addressLocality":"___","addressCountry":"CY"},"sameAs":["https://facebook.com/___","https://instagram.com/___"] }, null, 2);
function kopyala(id, btn){ const t=el(id); const m = t.value!=null?t.value:t.textContent; const ok=()=>{ if(btn){ const o=btn.textContent; btn.textContent='kopyalandı ✓'; setTimeout(()=>btn.textContent=o,1200); } }; if(navigator.clipboard) navigator.clipboard.writeText(m).then(ok,ok); else ok(); }
window.kopyala = kopyala;

// Ozet metnini motor uretir (rapor ile ayni cumleler cikssin diye); burada sadece
// panelin o anki site filtresi uygulanir.
const haftalikOzetUret = ()=> haftalikOzet(siteler(), tumOneriler(), VERI.degisiklikler, VERI.ozet?.ortalamaSeoPuan);

// ============ BÖLÜMLER ============
function siteKart(s){
  const sr = s.siralama||[];
  const ortPoz = sr.length ? +(sr.reduce((a,k)=>a+k.pozisyon,0)/sr.length).toFixed(1) : null;
  const top = sr[0];
  return `<div class="kart">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="dot bg-${s.uptime?.durum==='up'?'ok':'bad'}"></span>
        <div><b style="font-family:var(--disp);font-weight:600;font-size:16px">${s.ad}</b>
          <a href="${s.url}" target="_blank" rel="noopener" style="display:block;font-size:12.5px;color:var(--muted)">${kisaUrl(s.url)}</a></div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">${tbadge(s.seo?.trend)}${taramaRozeti(s)}</div>
    </div>
    <div style="display:flex;align-items:center;gap:16px;margin-top:14px">
      ${kadran(s.seo?.puan, 92)}
      <div class="mgrid" style="flex:1;grid-template-columns:1fr 1fr">
        ${mt('Sıralanan kelime', sr.length, '', sr.length?'':'mut')}
        ${mt('Ort. pozisyon', ortPoz??'—', '', posTon(ortPoz))}
        ${mt('Kırık link', (s.kirikLinkler?.length||0)===0?'0':s.kirikLinkler.length, '', linkTon(s.kirikLinkler?.length||0))}
        ${mt('Mobil hız', s.hiz?.mobilPuan??'—', s.hiz?'/100':'', hizTon(s.hiz?.mobilPuan))}
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)">
      ${top ? `<span>en iyi kelime</span> <span style="color:var(--text);font-weight:500">${top.kelime}</span> <span style="margin-left:auto;font-family:var(--disp);font-weight:600;color:var(--text)">#${top.pozisyon}</span>`
            : `<span>Search Console verisi yok</span>`}
    </div>
  </div>`;
}

const VIEWS = {
  genel(){
    const kartlar = siteler().map(siteKart).join('') || bosDurum('Aramaya uyan site yok.');
    const ilk3 = tumOneriler().slice(0,3);
    const aksiyon = ilk3.length ? `<div class="liste">${ilk3.map(a=>`<div class="li">
      <span class="pri ${a.oncelik}">${a.oncelik}</span><div class="txt">${a.hizliKazanim?'<span class="t-warn">⚡ </span>':''}${a.mesaj}</div>
      <span class="site">${a.site}</span></div>`).join('')}</div>` : bosDurum('Aksiyon gerektiren bir şey yok.');
    return bolumBaslik('Genel Bakış','Siteler','Her sitenin kendi sağlık kadranı ve metrikleri. Önce en acil işler.') +
      filtreBar() +
      stBaslik('Öncelikli işler', ilk3.length, "git('oneri')") + aksiyon +
      stBaslik('Tüm siteler', siteler().length) +
      `<div class="grid">${kartlar}</div>`;
  },

  // Tematik saglik: hesabin tamami assets/saglik-motoru.js'te (siteSaglik/portfoySaglik/…).
  // Burada sadece cizim var. "Puani etkiler" halkalari crawl.js'in ceza kalemlerinden
  // turer; "ayri olcum" halkalari puana girmeyen bagimsiz olcumlerdir.
  saglik(){
    const list = siteler();
    const bas = bolumBaslik('Genel','Site Sağlığı',
      'Tek puan yerine kırılım: hangi başlık puandan ne götürüyor. <b>puanı etkiler</b> rozetli halkalar SEO puanının kendisinden türer; <b>ayrı ölçüm</b> rozetliler puana girmez ama sorun çıkarır.');
    if(!list.length) return bas + filtreBar() + bosDurum('Aramaya uyan site yok.');

    const tek = list.length===1 ? list[0] : null;
    const sag = tek ? siteSaglik(tek) : null;
    const port = portfoySaglik(list);
    const dag = sayfaDagilim(list);
    const ai = aiSaglik(list);
    const onr = tumOneriler();
    const sirali = [...list].sort((a,b)=>(b.seo?.puan||0)-(a.seo?.puan||0));
    const ortalama = Math.round(list.reduce((a,s)=>a+(s.seo?.puan||0),0)/list.length);

    // --- 1) saglik kadrani ---
    const kart1 = `<div class="kart"><div class="tema-ust"><b>${tek?tek.ad:'Portföy sağlığı'}</b>
        ${tek?tbadge(tek.seo?.trend):`<span class="cip">${list.length} site</span>`}</div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:12px">${kadran(tek?tek.seo?.puan:ortalama, 86)}
        <div style="flex:1;font-size:12.5px;color:var(--muted);line-height:1.7">${ tek
          ? `Ceza toplamı <b class="t-bad">−${sag.ceza}</b> → <b style="color:var(--text)">${sag.hesaplanan}</b> puan.<br>
             ${sag.uyum?'<span class="t-ok">✓</span> crawl.js ile birebir tutuyor.':`<span class="t-warn">⚠</span> crawl.js ${sag.puan} diyor — formüller ayrışmış.`}`
          : `en iyi <b style="color:var(--text)">${sirali[0].ad}</b> ${sirali[0].seo?.puan}<br>
             en zayıf <b style="color:var(--text)">${sirali[sirali.length-1].ad}</b> ${sirali[sirali.length-1].seo?.puan}<br>
             <span style="color:var(--faint)">tek sitenin kırılımı için üstten site seç</span>` }</div></div></div>`;

    // --- 2) sayfa durum kirilimi (Semrush "Crawled Pages" karsiligi) ---
    // Bu bes durum ORTUSMEZ, toplami taranan URL sayisidir. Altindaki sorun turleri ise cakisir.
    const PAL = ['#F5B23B','#E8933B','#6E8BFF','#43D6C4','#8593AC','#F0607A'];
    const D = dag.durum;
    const DURUM = D ? [
      { ad:'Sağlam', adet:D.saglam, renk:'var(--ok)' },
      { ad:'Sorunlu', adet:D.sorunlu, renk:'var(--warn)' },
      { ad:'Kırık', adet:D.kirik, renk:'var(--bad)' },
      { ad:'Yönlendirme', adet:D.yonlendirme, renk:'var(--info)' },
      { ad:'robots ile engelli', adet:D.engelli, renk:'#8593AC' },
    ].filter(x=>x.adet>0) : [];
    const sorunToplam = dag.kalemler.reduce((a,k)=>a+k.adet,0);
    const kart2 = `<div class="kart"><div class="tema-ust"><b>Taranan sayfalar</b><span class="cip">${D?D.toplam:dag.taranan}</span></div>
      ${ D ? `<div class="cubuk" style="margin:12px 0 10px" role="img" aria-label="sayfa durumu dağılımı">${
            DURUM.map(x=>`<i style="width:${(x.adet/D.toplam*100).toFixed(1)}%;background:${x.renk}" title="${x.ad}: ${x.adet}"></i>`).join('')}</div>
          <ul class="kalem" style="border:0;padding:0">${DURUM.map(x=>
            `<li><span class="k-nokta" style="background:${x.renk}"></span><span class="k-ad">${x.ad}</span><span class="k-dg">${x.adet}</span></li>`).join('')}
            ${dag.noindex?`<li><span class="k-nokta" style="background:var(--line2)"></span><span class="k-ad">bunlardan noindex</span><span class="k-dg">${dag.noindex}</span></li>`:''}</ul>`
        : `<p class="not">Sayfa durumu kırılımı yok — <code>npm run crawl</code> ile yeniden tara.</p>` }
      ${ sorunToplam ? `<ul class="kalem" style="margin-top:10px">${dag.kalemler.map((k,i)=>
          `<li><span class="k-nokta" style="background:${k.ton==='bad'?'var(--bad)':PAL[i%PAL.length]}"></span><span class="k-ad">${k.ad}</span><span class="k-dg">${k.adet}</span></li>`).join('')}</ul>
        <p class="not">Alttaki sorun türleri çakışır: bir sayfa hem ince hem schema'sız olabilir.</p>` : '' }</div>`;

    // --- 3) AI / GEO sagligi ---
    const kart3 = ai ? `<div class="kart"><div class="tema-ust"><b>AI arama hazırlığı</b><span class="cip sig">${ai.toplamSite} site</span></div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:11px">${halka(ai.puan, 72)}
        <ul class="kalem" style="border:0;padding:0;flex:1">${ai.bilesen.map(b=>
          `<li><span class="k-ad" title="${b.aciklama}">${b.ad}</span><span class="k-dg t-${puanTon(b.puan)}">${b.puan}%</span></li>`).join('')}</ul></div>
      ${ ai.gorunurluk.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:11px">${ai.gorunurluk.map(g=>
          cip(`${g.motor} ${g.gorulen}/${g.olculen}`, g.gorulen?'sig':'')).join('')}</div>` : '' }
      <p class="not">Ölçülmeyen: ${ai.eksikOlcum.join(' · ')}</p></div>` : '';

    // --- 3b) AI aramaya kapali (Semrush "Blocked from AI Search" karsiligi) ---
    const bot = aiBotEngeli(list);
    const kartBot = bot ? `<div class="kart"><div class="tema-ust"><b>AI aramaya kapalı</b>
        ${bot.engelliOlanlar.length?cip(bot.engelliOlanlar.length+' bot','bad'):cip('yok','ok')}</div>
      <p class="not" style="margin:7px 0 0">robots.txt kurallarına göre — ${bot.taranan} sayfa üzerinden.</p>
      ${ bot.engelliOlanlar.length
        ? `<ul class="kalem" style="margin-top:9px;border:0;padding:0">${bot.engelliOlanlar.slice(0,6).map(b=>
            `<li><span class="k-ad">${b.ad}<s>${b.sirket} · ${b.not}</s></span>
             <span class="k-dg t-bad">${b.engelliSayfa}</span></li>`).join('')}</ul>`
        : `<div style="font-size:12.5px;color:var(--ok);margin-top:9px">Hiçbir AI botu engellenmiyor.</div>` }
      ${ bot.sinyaller.length ? `<p class="not">Content-Signal: ${bot.sinyaller.map(x=>`${x.site} → ${x.ham}`).join(' · ')}</p>` : '' }</div>` : '';

    // --- 4) aksiyon ---
    const say = (p)=> onr.filter(o=>o.oncelik===p).length;
    const hizli = onr.filter(o=>o.hizliKazanim).length;
    const kart4 = `<div class="kart"><div class="tema-ust"><b>Aksiyon</b>
        <button class="more" onclick="git('oneri')" style="margin-left:auto">tümü →</button></div>
      <div class="mgrid" style="grid-template-columns:1fr 1fr;margin-top:11px">
        ${mt('Kritik', say('kritik'), '', say('kritik')?'bad':'ok')}
        ${mt('Yüksek', say('yuksek'), '', say('yuksek')?'bad':'ok')}
        ${mt('Orta', say('orta'), '', 'warn')}
        ${mt('⚡ Hızlı kazanım', hizli, '', hizli?'sig':'mut')}</div>
      <p class="not">Aynı öneri motoru (assets/oneri-motoru.js) panel, rapor ve Telegram bildiriminde ortak.</p></div>`;

    // --- tematik halkalar ---
    const rozet = (k)=> k.tip==='puan'
      ? (k.ceza ? cip(`−${k.ceza} puan`,'bad') : cip('puanı etkiler','ok'))
      : cip('ayrı ölçüm','');
    // "−3" yalnizca puana giren kategorilerde puan demek. Olcum kategorilerinde ceza
    // sadece "burada sorun var" isaretidir -> puan dusuyormus gibi gostermemek icin "!".
    const kalemSatir = (kl, tip)=> `<li class="${kl.bilgi?'bilgi':kl.ceza?'':'gecti'}">
      <span class="k-ad">${kl.ad}</span><span class="k-dg">${kl.deger}</span>
      <span class="k-cz ${tip==='olcum'&&kl.ceza?'uyar':''}">${kl.bilgi?'':!kl.ceza?'✓':tip==='puan'?'−'+kl.ceza:'!'}</span></li>`;
    // portfoy modunda halka, SADECE olculebilmis sitelerin ortalamasi -> kapsami rozetle goster,
    // yoksa "1 sitede olculen indeks orani" 5 sitenin durumu sanilir.
    const kapsam = (k)=> (k.olculen!=null && k.olculen<k.toplam)
      ? cip(`${k.olculen}/${k.toplam} site`, k.olculen?'warn':'') : '';
    const temaKart = (k)=> `<div class="tema">
      <div class="tema-ust"><span class="tema-ik">${k.ik}</span><b>${k.ad}</b>
        <span class="tema-rozet">${rozet(k)}${kapsam(k)}</span></div>
      <div class="tema-orta">${halka(k.puan)}<div class="tema-not">${k.puan==null?'ölçülmedi — '+k.aciklama:k.aciklama}</div></div>
      ${ k.kalemler?.length ? `<ul class="kalem">${k.kalemler.map(kl=>kalemSatir(kl,k.tip)).join('')}</ul>`
        : `<ul class="kalem"><li class="bilgi"><span class="k-ad">ölçülen site</span><span class="k-dg">${k.olculen}/${k.toplam}</span></li></ul>` }</div>`;

    const kategoriler = tek ? sag.kategoriler : port.kategoriler;
    const puanlilar = kategoriler.filter(k=>k.tip==='puan');
    const olcumler  = kategoriler.filter(k=>k.tip==='olcum');

    // --- coklu site: kategori x site matrisi ---
    const hucre = (p)=> p==null ? '<span style="color:var(--faint)">–</span>'
      : `<span class="t-${puanTon(p)}" style="font-family:var(--disp);font-weight:600">${p}</span>`;
    const matris = tek ? '' : stBaslik('Site × kategori', list.length) +
      `<div class="tablo-kap"><table class="tablo" style="min-width:${180+kategoriler.length*74}px"><thead><tr><th>Site</th>
        ${kategoriler.map(k=>`<th class="ort" title="${k.ad}">${k.kisa||k.ad}</th>`).join('')}</tr></thead>
        <tbody>${port.siteler.map(({site,saglik})=>`<tr><td class="site-ad">${site.ad}</td>
          ${saglik.kategoriler.map(k=>`<td class="ort">${hucre(k.puan)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

    // --- AI bot erisim tablosu (bot × site) ---
    const robotslu = list.filter(s=>s.robots?.botlar?.length);
    const botTablo = bot ? stBaslik('AI bot erişimi (robots.txt)', bot.botlar.length) +
      `<div class="tablo-kap"><table class="tablo" style="min-width:${340+robotslu.length*95}px"><thead><tr>
        <th>Bot</th><th>Ne için</th>${robotslu.map(s=>`<th class="ort">${s.ad}</th>`).join('')}</tr></thead>
        <tbody>${bot.botlar.map(b=>`<tr>
          <td><span class="site-ad">${b.ad}</span> <span style="color:var(--faint);font-size:11px">${b.sirket}</span></td>
          <td style="color:var(--muted);font-size:12px">${b.not}${b.ai?'':' '+cip('AI değil','')}</td>
          ${robotslu.map(s=>{ const x=(s.robots.botlar||[]).find(y=>y.id===b.id);
            return `<td class="ort">${!x?'–':x.izin?cip('serbest','ok'):cip(x.tamKapali?'tamamen kapalı':x.engelliSayfa+' sayfa','bad')}</td>`;}).join('')}
        </tr>`).join('')}</tbody></table></div>
      <p class="not">Engelli botlar siteni tarayamaz; ChatGPT/Claude/Perplexity cevaplarında kaynak gösteremezsin. Açmak için Araçlar → robots.txt bloğunu kullan.</p>` : '';

    // --- sorunlu sayfa listeleri (tek site seciliyken) ---
    const sayfaListe = (baslik, list2, sutun)=> !list2?.length ? '' :
      `<div class="tablo-kap" style="margin-bottom:14px"><div class="tablo-bas">${baslik}${cip(list2.length,'')}</div>
        <table class="tablo" style="min-width:520px"><thead><tr><th>Sayfa</th>${sutun.map(s=>`<th class="${s.ort?'ort':''}">${s.ad}</th>`).join('')}</tr></thead>
        <tbody>${list2.map(k=>`<tr><td>${k.yol}</td>${sutun.map(s=>`<td class="${s.ort?'ort':''}" style="color:var(--muted);font-size:12px">${s.al(k)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const detay = !tek ? '' : (
      sayfaListe('Taramada hata veren sayfalar', tek.kirikSayfalar, [{ad:'Kod',ort:true,al:k=>cip(k.kod||k.hata||'hata','bad')}]) +
      sayfaListe('Yönlendirmeler', tek.yonlendirmeler, [{ad:'Kod',ort:true,al:k=>cip(k.kod,'')},{ad:'Hedef',al:k=>k.hedef}]) +
      sayfaListe('robots.txt ile engelli sayfalar', tek.engelliSayfalar, [{ad:'Kural',al:k=>`<code>${k.kural||'—'}</code>`}]) +
      sayfaListe('Sorunlu sayfalar', tek.sorunluSayfalar, [{ad:'Sorun',al:k=>(k.sorunlar||[]).join(' · ')}])
    );
    const detayBaslik = detay ? stBaslik('Sayfa dökümü', tek.sayfaDurum?.toplam) : '';

    return bas + filtreBar() +
      `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(270px,1fr))">${kart1}${kart2}${kart3}${kartBot}${kart4}</div>` +
      stBaslik('Puanı oluşturan başlıklar', puanlilar.length) +
      `<div class="tema-grid">${puanlilar.map(temaKart).join('')}</div>` +
      stBaslik('Ayrı ölçümler', olcumler.length) +
      `<div class="tema-grid">${olcumler.map(temaKart).join('')}</div>` +
      botTablo + matris + detayBaslik + detay;
  },

  oneri(){
    let list = tumOneriler();
    const say = (p)=> list.filter(o=>o.oncelik===p).length;
    const eforCip = (e)=> cip(EFOR_AD[e], e===1?'ok':e===2?'warn':'bad');
    const hizli = list.filter(o=>o.hizliKazanim);
    const satir = (o)=> `<div class="li">
      <span class="pri ${o.oncelik}">${o.oncelik}</span>
      <div class="txt">${o.hizliKazanim?'<span class="t-warn">⚡ </span>':''}${o.mesaj}<s>[${o.site}] · ${o.alan}</s></div>
      <span class="site" style="display:flex;align-items:center;gap:5px"><span style="font-size:10px;color:var(--faint)">efor</span>${eforCip(o.efor)}</span></div>`;
    return bolumBaslik('Değerlendirme','Öneriler / Aksiyon','Her sorun önceliklendirilmiş + etki/efor skoruyla. ⚡ işaretliler önce yapılmalı.') +
      filtreBar() +
      `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:18px">
        ${karo('Kritik', say('kritik'), 'hemen', say('kritik')?'bad':'ok')}
        ${karo('Yüksek', say('yuksek'), 'bu hafta', say('yuksek')?'bad':'ok')}
        ${karo('Orta', say('orta'), 'planla', 'warn')}
        ${karo('Düşük', say('dusuk'), 'fırsat buldukça')}
      </div>` +
      (hizli.length ? stBaslik('⚡ Hızlı kazanımlar', hizli.length) + `<div class="liste" style="margin-bottom:8px">${hizli.map(satir).join('')}</div>` : '') +
      stBaslik('Tüm öneriler', list.length) +
      (list.length ? `<div class="liste">${list.map(satir).join('')}</div>` : bosDurum('🎉 Aksiyon gerektiren bir şey yok.'));
  },

  siteler(){
    const satir = (s)=> `<tr>
      <td><div style="display:flex;align-items:center;gap:8px"><span class="dot bg-${s.uptime?.durum==='up'?'ok':'bad'}"></span>
        <div><div class="site-ad">${s.ad} ${taramaRozeti(s, true)}</div><a href="${s.url}" target="_blank" style="font-size:12px;color:var(--signal)">${kisaUrl(s.url)}</a></div></div></td>
      <td class="ort t-${puanTon(s.seo?.puan)}" style="font-family:var(--disp);font-weight:600">${s.seo?.puan??'–'}</td>
      <td class="ort">${tbadge(s.seo?.trend)}</td>
      <td class="ort">${s.sayfalar?.taranan??'–'}</td>
      <td class="ort">${(s.kirikLinkler?.length||0)?`<span class="t-bad">${s.kirikLinkler.length}</span>`:'<span class="t-ok">0</span>'}</td>
      <td class="ort">${sslCip(s.ssl)}</td></tr>`;
    return bolumBaslik('Genel','Siteler','Takip edilen tüm siteler. Yeni site için sites.config.json.') + filtreBar() +
      `<div class="tablo-kap"><table class="tablo" style="min-width:640px"><thead><tr>
        <th>Site</th><th class="ort">SEO</th><th class="ort">Trend</th><th class="ort">Sayfa</th><th class="ort">Kırık</th><th class="ort">SSL</th>
      </tr></thead><tbody>${siteler().map(satir).join('')}</tbody></table></div>`;
  },

  // Sorunlar: crawl.js'in urettigi bulgu listesi, seviyeye gore.
  // Metinler (neden/nasil) assets/sorun-katalogu.js'ten gelir — panel, rapor ve MCP
  // ayni cumleleri okur; bir sorunun aciklamasi uc yerde ayrisamaz.
  sorunlar(){
    const list = siteler();
    const varMi = list.some(s => (s.sorunlar||[]).length);
    const bas = bolumBaslik('Teknik SEO','Sorunlar',
      'Denetim bulgulari: her sorunun seviyesi, kaç sayfayı etkilediği, neden önemli olduğu ve nasıl düzeltileceği.');
    if(!varMi) return bas + filtreBar() +
      bosDurum('Bu veri son taramadan önce üretilmiş. <code>npm run crawl</code> ile yeniden tara.');

    // portfoy gorunumunde tipler birlestirilir, tek site secilince o sitenin listesi
    const hepsi = SECILI_SITE
      ? sorunlariZenginlestir((list[0]?.sorunlar)||[]).map(b=>({...b, siteler:[{id:list[0].id, ad:list[0].ad, adet:b.adet}]}))
      : sorunOzeti(list);
    const say = (sv)=> hepsi.filter(b=>b.seviye===sv).reduce((a,b)=>a+b.adet,0);
    const gorunen = SORUN_SEVIYE ? hepsi.filter(b=>b.seviye===SORUN_SEVIYE) : hepsi;

    const sv = (id,ad,ton,n)=>`<button class="fcip ${SORUN_SEVIYE===id?'aktif':''}" onclick="sorunSeviye('${id}')">
      ${ad}${n!=null?` <span class="t-${ton}">${n}</span>`:''}</button>`;
    const seviyeBar = `<div class="filtre"><span class="fl">Seviye</span>
      ${sv('','Hepsi','mut',hepsi.reduce((a,b)=>a+b.adet,0))}
      ${sv('kritik','Kritik','bad',say('kritik'))}
      ${sv('uyari','Uyarı','warn',say('uyari'))}
      ${sv('bilgi','Bilgi','mut',say('bilgi'))}
      <button class="fcip" onclick="sorunCsv()" title="Görünen bulguları CSV olarak indir">⤓ CSV</button></div>`;

    const ton = { kritik:'bad', uyari:'warn', bilgi:'mut' };
    const isaret = { kritik:'●', uyari:'▲', bilgi:'·' };
    const kart = (b)=>{
      const nerede = (b.siteler||[]).map(x=>`${x.ad} (${x.adet})`).join(' · ');
      const orn = (b.ornekler||[]).slice(0,8)
        .map(o=>`<li class="bilgi"><span class="k-ad">${o.yol}</span><span class="k-dg">${o.deger||''}</span></li>`).join('');
      return `<details class="sorun-kart">
        <summary><span class="t-${ton[b.seviye]}">${isaret[b.seviye]}</span>
          <b>${b.baslik}</b>
          <span class="cip ${ton[b.seviye]}">${b.adet}</span>
          ${b.puana?'':'<span class="cip mut" title="Bu bulgu gerçek bir sorundur ama SEO puanı formülüne dahil değildir">puana girmiyor</span>'}
          <span class="sorun-nerede">${nerede}</span></summary>
        <div class="sorun-govde">
          <p><b>Neden önemli:</b> ${b.neden}</p>
          <p><b>Nasıl düzeltilir:</b> ${b.nasil}</p>
          ${orn?`<ul class="kalem">${orn}</ul>`:''}
        </div></details>`;
    };
    return bas + filtreBar() + seviyeBar +
      (gorunen.length ? gorunen.map(kart).join('') : bosDurum('Bu seviyede bulgu yok.'));
  },

  denetim(){
    const satir = (s)=>{ const em=s.eksikMeta||{}; const eksik=(em.title||0)+(em.description||0)+(em.h1||0); const op=s.onpage||{};
      return `<tr><td class="site-ad">${s.ad}</td>
        <td class="ort">${eksik?cip(eksik,'warn'):cip('0','ok')}</td>
        <td class="ort">${durumCip(s.schema?.gecerli,'OK','yok')}</td>
        <td class="ort">${durumCip(s.sitemap?.varMi&&s.sitemap.erisilemez===0,'OK','sorun')}</td>
        <td class="ort">${durumCip((s.canonical?.eksik||0)+(s.canonical?.hatali||0)===0,'OK','sorun')}</td>
        <td class="ort">${durumCip(!s.hreflang?.sorun,'OK','sorun')}</td>
        <td class="ort">${(op.altEksik||0)?cip(op.altEksik,'warn'):cip('0','ok')}</td>
        <td class="ort">${op.tracking?.length?cip(op.tracking.join('+'),'ok'):cip('yok','bad')}</td></tr>`; };
    return bolumBaslik('Teknik SEO','SEO Denetim','Meta, schema, sitemap, canonical, hreflang + on-page (alt text, tracking).') + filtreBar() +
      `<div class="tablo-kap"><table class="tablo" style="min-width:720px"><thead><tr>
        <th>Site</th><th class="ort">Eksik meta</th><th class="ort">Schema</th><th class="ort">Sitemap</th><th class="ort">Canonical</th><th class="ort">hreflang</th><th class="ort">Alt eksik</th><th class="ort">Tracking</th>
      </tr></thead><tbody>${siteler().map(satir).join('')}</tbody></table></div>`;
  },

  kirik(){
    const bloklar = siteler().map(s=>{ const list=s.kirikLinkler||[]; if(!list.length) return '';
      const satir=(k)=>`<tr><td>${k.kaynak}</td><td style="color:var(--muted)">${k.hedef}</td><td class="ort">${cip(k.kod,'bad')}</td></tr>`;
      return `<div class="tablo-kap" style="margin-bottom:14px"><div class="tablo-bas">${s.ad}${cip(list.length+' kırık link','bad')}</div>
        <table class="tablo" style="min-width:520px"><thead><tr><th>Kaynak sayfa</th><th>Hedef</th><th class="ort">Kod</th></tr></thead>
        <tbody>${list.map(satir).join('')}</tbody></table></div>`; }).join('');
    return bolumBaslik('Teknik SEO','Kırık Linkler','404/410/5xx veren bağlantılar. Rate-limit (429) sayılmaz.') + filtreBar() +
      (bloklar || bosDurum('🎉 Kırık link yok.'));
  },

  hiz(){
    const vc = (v,iyi,orta,birim)=> v==null?cip('–','mut'):cip(v+(birim||''), v<=iyi?'ok':v<=orta?'warn':'bad');
    const satir=(s)=>{ const h=s.hiz||{}; return `<tr><td class="site-ad">${s.ad}</td>
      <td class="ort t-${hizTon(h.mobilPuan)}" style="font-family:var(--disp);font-weight:600">${h.mobilPuan??'–'}</td>
      <td class="ort t-${hizTon(h.masaustuPuan)}" style="font-family:var(--disp);font-weight:600">${h.masaustuPuan??'–'}</td>
      <td class="ort">${vc(h.lcp,2.5,4,' s')}</td><td class="ort">${vc(h.inp,200,500,' ms')}</td><td class="ort">${vc(h.cls,0.1,0.25,'')}</td>
      <td class="ort t-${hizTon(h.erisilebilirlik)}" style="font-family:var(--disp)">${h.erisilebilirlik??'–'}</td>
      <td class="ort t-${hizTon(h.enIyiUygulama)}" style="font-family:var(--disp)">${h.enIyiUygulama??'–'}</td>
      <td class="ort t-${hizTon(h.lighthouseSeo)}" style="font-family:var(--disp)">${h.lighthouseSeo??'–'}</td></tr>`; };
    return bolumBaslik('Teknik SEO','Hız / Core Web Vitals',
      'LCP, INP, CLS + mobil/masaüstü. Sağdaki üç sütun Lighthouse\'un diğer kategorileri — aynı istekten geliyor, ek maliyeti yok.') + filtreBar() +
      `<div class="tablo-kap"><table class="tablo" style="min-width:760px"><thead><tr>
        <th>Site</th><th class="ort">Mobil</th><th class="ort">Masaüstü</th><th class="ort">LCP</th><th class="ort">INP</th><th class="ort">CLS</th>
        <th class="ort" title="Lighthouse erişilebilirlik puanı">Erişilebilirlik</th>
        <th class="ort" title="Lighthouse best practices puanı">En iyi uygulama</th>
        <th class="ort" title="Lighthouse'un kendi SEO puanı — bizim denetimimizden bağımsız çapraz kontrol">LH SEO</th>
      </tr></thead><tbody>${siteler().map(satir).join('')}</tbody></table></div>`;
  },

  iclink(){
    const satir=(s)=>{ const i=s.iclink||{}; const orphan=i.orphan||[]; const y=icLinkYorum(i.ortLink);
      return `<tr><td class="site-ad">${s.ad}</td><td class="ort">${i.ortLink??'–'}</td><td class="ort">${cip(y.metin,y.ton==='ok'?'ok':y.ton==='warn'?'warn':'')}</td>
      <td class="ort">${orphan.length?cip(orphan.length,'warn'):cip('0','ok')}</td><td style="color:var(--muted);font-size:12px">${orphan.length?orphan.join('<br>'):'—'}</td></tr>`; };
    return bolumBaslik('Teknik SEO','İç Linkleme & Orphan','Değerlendirme: <5 az, 5-15 ideal, >15 çok. Öksüz sayfalar hiç iç link almıyor.') + filtreBar() +
      `<div class="tablo-kap"><table class="tablo" style="min-width:620px"><thead><tr>
        <th>Site</th><th class="ort">Ort. iç link/sayfa</th><th class="ort">Değerlendirme</th><th class="ort">Orphan</th><th>Orphan sayfalar</th>
      </tr></thead><tbody>${siteler().map(satir).join('')}</tbody></table></div>`;
  },

  indeks(){
    const satir=(s)=>{ const i=s.indeks;
      if(!i || !i.nedenler) return `<tr><td class="site-ad">${s.ad}</td><td class="ort" colspan="4" style="color:var(--faint)">veri yok — <code>npm run indeks</code> çalıştır</td></tr>`;
      const oran = i.kontrolEdilen ? Math.round(i.indeksli/i.kontrolEdilen*100) : 0;
      return `<tr><td class="site-ad">${s.ad}</td><td class="ort t-ok">${i.indeksli}</td>
      <td class="ort ${i.aksiyonGereken?'t-warn':''}">${i.aksiyonGereken??i.indekssiz}</td>
      <td class="ort">${oran}%<span style="color:var(--faint)"> (${i.kontrolEdilen}/${i.toplamSayfa??i.kontrolEdilen})</span></td>
      <td class="ort">${i.dususVar?cip('düşüş var','bad'):cip('stabil','ok')}</td></tr>`; };

    // neden kirilimi: asil teshis burada
    const bloklar = siteler().filter(s=>s.indeks?.nedenler?.length).map(s=>{
      const nsatir=(n)=>`<tr><td>${n.sorun?'⚠':'·'} ${n.neden}</td><td class="ort" style="font-family:var(--disp);font-weight:600">${n.adet}</td>
        <td style="color:var(--muted);font-size:12px">${n.cozum||'—'}</td>
        <td style="color:var(--faint);font-size:11px">${(n.ornekler||[]).join('<br>')}</td></tr>`;
      return `<div class="tablo-kap" style="margin-bottom:14px"><div class="tablo-bas">${s.ad}</div>
        <table class="tablo" style="min-width:640px"><thead><tr><th>Neden</th><th class="ort">Sayfa</th><th>Ne yapmalı</th><th>Örnek</th></tr></thead>
        <tbody>${s.indeks.nedenler.map(nsatir).join('')}</tbody></table></div>`; }).join('');

    return bolumBaslik('Teknik SEO','İndeks Monitörü','URL Inspection API ile sayfa sayfa gerçek indeks durumu. ⚠ işaretli nedenler aksiyon ister; diğerleri normaldir.') + filtreBar() +
      `<div class="tablo-kap" style="margin-bottom:18px"><table class="tablo" style="min-width:560px"><thead><tr>
        <th>Site</th><th class="ort">İndeksli</th><th class="ort">Aksiyon gereken</th><th class="ort">İndeks oranı</th><th class="ort">Durum</th>
      </tr></thead><tbody>${siteler().map(satir).join('')}</tbody></table></div>` + bloklar;
  },

  kelime(){
    const bloklar = siteler().map(s=>{ const list=s.siralama||[]; if(!list.length) return '';
      const satir=(k)=>{ const yon=k.pozisyon<k.onceki?'▲':k.pozisyon>k.onceki?'▼':'–'; const rk=k.pozisyon<k.onceki?'t-ok':k.pozisyon>k.onceki?'t-bad':'t-mut';
        return `<tr><td>${k.kelime}</td><td class="ort" style="font-family:var(--disp);font-weight:600">#${k.pozisyon}</td>
        <td class="ort ${rk}">${yon} ${Math.abs((k.onceki||k.pozisyon)-k.pozisyon)||''}</td><td class="ort" style="color:var(--muted)">${k.gosterim??'–'}</td>
        <td class="ort" style="color:var(--muted)">${k.tik??'–'}</td></tr>`; };
      return `<div class="tablo-kap" style="margin-bottom:14px"><div class="tablo-bas">${s.ad}${olcumNotu(s)}</div>
        <table class="tablo" style="min-width:520px"><thead><tr><th>Anahtar kelime</th><th class="ort">Pozisyon</th><th class="ort">Değişim</th><th class="ort">Gösterim</th><th class="ort">Tık</th></tr></thead>
        <tbody>${list.map(satir).join('')}</tbody></table></div>`; }).join('');
    return bolumBaslik('İçerik & Sıralama','Anahtar Kelime','Search Console gerçek sıralama + trend.') + filtreBar() +
      `<div style="margin-bottom:14px">${asamaRozeti(3)}</div>` + (bloklar || bosDurum('Henüz sıralama verisi yok — Search Console bağla.'));
  },

  gap(){
    const bloklar = siteler().map(s=>{ const list=s.icerikBoslugu||[]; if(!list.length) return '';
      const firsatMi = list.some(g=>g.tip==='firsat');
      const satir=(g)=>{ const konum = g.tip==='firsat' ? `<span class="t-warn">#${g.rakipPoz}</span> <span style="color:var(--faint)">(sayfa ${Math.ceil(g.rakipPoz/10)})</span>` : `${g.rakip} <span style="color:var(--faint)">#${g.rakipPoz}</span>`;
        return `<tr><td>${g.kelime}</td><td class="ort">${g.hacim}</td><td>${konum}</td><td class="ort">${g.hacim>=200?cip('yüksek fırsat','ok'):cip('fırsat','warn')}</td></tr>`; };
      return `<div class="tablo-kap" style="margin-bottom:14px"><div class="tablo-bas">${s.ad}${olcumNotu(s)}</div>
        <table class="tablo" style="min-width:520px"><thead><tr><th>Kelime</th><th class="ort">Gösterim</th><th>${firsatMi?'Senin pozisyonun':'Rakip'}</th><th class="ort">Durum</th></tr></thead>
        <tbody>${list.map(satir).join('')}</tbody></table></div>`; }).join('');
    return bolumBaslik('İçerik & Sıralama','İçerik Boşluğu / Fırsat','2. sayfada yüksek gösterimli kelimeler = az itmeyle 1. sayfaya çıkacak fırsatlar.') + filtreBar() +
      `<div style="margin-bottom:14px">${asamaRozeti(3)}</div>` + (bloklar || bosDurum('Henüz fırsat verisi yok.'));
  },

  rakip(){
    const store = rakipEkGetir();
    const form = `<div class="kart" style="margin-bottom:18px">
      <p style="font-family:var(--disp);font-weight:600;margin:0 0 11px">Rakip ekle <span style="font-size:11px;color:var(--faint);font-weight:400">(tarayıcında saklanır)</span></p>
      <div style="display:grid;gap:8px;grid-template-columns:1fr 1fr 1fr auto">
        <select id="rk-site" class="alan">${(VERI.siteler||[]).map(s=>`<option value="${s.id}">${s.ad}</option>`).join('')}</select>
        <input id="rk-kelime" class="alan" placeholder="anahtar kelime" />
        <input id="rk-ad" class="alan" placeholder="rakip alan adı" />
        <button class="btn primary" onclick="rakipEkle()">+ Ekle</button>
      </div></div>`;
    const bloklar = siteler().map(s=>{ const list=[...(s.rakip||[]), ...((store[s.id]||[]))]; if(!list.length) return '';
      const manuelBas=(s.rakip||[]).length;
      const satir=(r,i)=>{ const olculdu=r.biz!=null&&r.rakipPoz!=null; const onde=olculdu&&r.biz<r.rakipPoz;
        const durum = !olculdu?cip('ölçüm bekliyor',''):onde?cip('öndesin','ok'):cip('geridesin','bad');
        const sil = r.manuel?`<button class="btn mini" style="border-color:var(--bad);color:var(--bad)" onclick="rakipSil('${s.id}',${i-manuelBas})">sil</button>`:'';
        return `<tr><td>${r.kelime}${r.manuel?' <span class="t-sig" style="font-size:10px">(manuel)</span>':''}</td><td style="color:var(--muted)">${r.ad}</td>
        <td class="ort" style="font-family:var(--disp);font-weight:600">${r.biz!=null?'#'+r.biz:'—'}</td><td class="ort" style="color:var(--muted)">${r.rakipPoz!=null?'#'+r.rakipPoz:'—'}</td>
        <td class="ort">${durum}</td><td class="ort">${sil}</td></tr>`; };
      return `<div class="tablo-kap" style="margin-bottom:14px"><div class="tablo-bas">${s.ad}</div>
        <table class="tablo" style="min-width:600px"><thead><tr><th>Kelime</th><th>Rakip</th><th class="ort">Sen</th><th class="ort">Rakip</th><th class="ort">Durum</th><th></th></tr></thead>
        <tbody>${list.map(satir).join('')}</tbody></table></div>`; }).join('');
    return bolumBaslik('İçerik & Sıralama','Rakip Analizi','Rakipleri manuel ekle; pozisyonlar SERP kontrolüyle dolar.') + filtreBar() + form + (bloklar || bosDurum('Henüz rakip yok. Yukarıdan ekle.'));
  },

  icerik(){
    const firsatlar = [];
    (VERI.siteler||[]).forEach(s => (s.icerikBoslugu||[]).forEach(g=>{ if(g.tip==='firsat') firsatlar.push({siteId:s.id,site:s.ad,kelime:g.kelime,poz:g.rakipPoz}); }));
    const uretilen = VERI.uretilenIcerikler||[];
    // Uretim Claude ile: satirin butonu, bu repoda acik Claude Code oturumuna yapistirilacak
    // hazir promptu kopyalar. Prompt, uretilen yaziyi icerik-ekle.js ile panele de ekletir.
    const attr = (v)=> String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
    const claudePrompt = (f)=> `${f.site} sitesi (siteId: ${f.siteId}) için "${f.kelime}" anahtar kelimesini hedefleyen `
      + `SEO uyumlu blog içeriği yaz. Önce seotakip MCP'de baglam_oku(site: "${f.siteId}") ile sitenin bağlamını oku, `
      + `sonra ai-seo skill'ini kullan. 600-1000 kelime gövde, H2/H3 alt başlıklar, anahtar kelime başlıkta ve ilk `
      + `paragrafta, sonunda "## Sıkça Sorulan Sorular" bölümü (### soru + cevap). İç linkleri yalnızca sitenin gerçek `
      + `sayfalarına ver, URL uydurma. Yazıyı frontmatter'lı markdown olarak kaydet (siteId, kelime, baslik, metaAciklama, `
      + `kaynak: Claude) ve "node scripts/icerik-ekle.js <dosya>" ile panele ekle.`;
    const oneriSatir = (f,i)=>`<tr><td>${f.kelime}</td><td style="color:var(--muted)">${f.site}</td><td class="ort">${cip('#'+f.poz,'warn')}</td>
      <td class="ort"><input id="cmd-${i}" class="gizli" value="${attr(claudePrompt(f))}"><button class="btn mini" onclick="kopyala('cmd-${i}',this)">Claude promptu kopyala</button></td></tr>`;
    const kart = (c,i)=>`<div class="kart" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:12px">
      <div><p style="font-family:var(--disp);font-weight:600;margin:0">${c.baslik}</p><p style="font-size:11px;color:var(--faint);margin:2px 0 0">${c.site} · "${c.kelime}" · ${c.kelimeSayisi} kelime · ${c.tarih}${c.kaynak?' · '+c.kaynak:''}</p></div>
      <button class="btn mini" onclick="document.getElementById('body-${i}').classList.toggle('gizli')">göster/gizle</button></div>
      <p style="font-size:12.5px;color:var(--muted);margin:9px 0 0">${c.metaAciklama||''}</p>
      <div id="body-${i}" class="gizli" style="margin-top:11px"><div style="text-align:right;margin-bottom:5px"><button class="btn mini" onclick="kopyala('md-${i}',this)">markdown kopyala</button></div>
        <textarea id="md-${i}" class="alan" readonly rows="12">${(c.govde||'').replace(/</g,'&lt;')}</textarea></div></div>`;
    return bolumBaslik('İçerik & Sıralama','AI İçerik / Auto SEO Blog','SEO uyumlu içerik üret. Fırsat kelimelerine göre konu önerisi + üretilen yazılar.') +
      `<div class="kart" style="margin-bottom:18px;font-size:13.5px;color:var(--muted);line-height:1.6">
        <p style="color:var(--text);font-weight:600;margin:0 0 4px">Nasıl çalışır?</p>
        <b>A — Claude ile (önerilen):</b> Aşağıdaki satırda <b>“Claude promptu kopyala”</b>ya bas, bu repodaki Claude Code oturumuna yapıştır.
        İçerik üretilir ve <code style="color:var(--signal)">node scripts/icerik-ekle.js</code> ile panele eklenir — API anahtarı gerekmez.<br>
        <b>B — Gemini (yedek):</b> <code style="color:var(--signal)">.env</code>'e <code style="color:var(--signal)">GEMINI_API_KEY</code> ekle,
        <code style="color:var(--signal)">node scripts/aiblog.js &lt;siteId&gt; "&lt;kelime&gt;"</code> çalıştır.</div>` +
      stBaslik('Önerilen konular', firsatlar.length) +
      (firsatlar.length ? `<div class="tablo-kap"><table class="tablo" style="min-width:520px"><thead><tr><th>Kelime</th><th>Site</th><th class="ort">Poz</th><th class="ort">Üret</th></tr></thead><tbody>${firsatlar.map(oneriSatir).join('')}</tbody></table></div>` : bosDurum('Fırsat kelimesi yok — Search Console bağla.')) +
      stBaslik('Üretilen içerikler', uretilen.length) +
      (uretilen.length ? uretilen.map(kart).join('') : bosDurum('Henüz içerik üretilmedi.'));
  },

  geo(){
    const k = ['chatgpt','perplexity','gemini','claude'], ad = {chatgpt:'ChatGPT',perplexity:'Perplexity',gemini:'Gemini',claude:'Claude'};
    const satir=(s)=> `<tr><td class="site-ad">${s.ad}</td>${k.map(x=>`<td class="ort">${s.geo&&s.geo[x]!==undefined?(s.geo[x]?cip('görülüyor','sig'):cip('yok','')):cip('ölçülmedi','mut')}</td>`).join('')}</tr>`;
    const detay = siteler().flatMap(s=>(s.geoDetay||[]).map(d=>({s:s.ad,...d})));
    return bolumBaslik('GEO / AI','GEO Görünürlük','Marka AI motorlarında (ChatGPT/Perplexity/Gemini/Claude) çıkıyor mu.') + filtreBar() +
      `<div class="tablo-kap"><table class="tablo" style="min-width:560px"><thead><tr><th>Site</th>${k.map(x=>`<th class="ort">${ad[x]}</th>`).join('')}</tr></thead><tbody>${siteler().map(satir).join('')}</tbody></table></div>` +
      (detay.length ? stBaslik('Kontrol detayları', detay.length) + `<div class="liste">${detay.map(d=>`<div class="li"><span class="pri ${d.gorundu?'dusuk':'orta'}">${d.gorundu?'var':'yok'}</span><div class="txt">${d.not}<s>[${d.s}] · ${d.soru}</s></div></div>`).join('')}</div>` : '');
  },

  botlar(){
    const satir=(s)=>{ const b=s.aiBotlar; if(!b) return `<tr><td class="site-ad">${s.ad}</td><td class="ort" colspan="5" style="color:var(--faint)">log yok — botlog.js çalıştır</td></tr>`;
      return `<tr><td class="site-ad">${s.ad}</td><td class="ort">${cip('GPTBot '+(b.gptbot||0), b.gptbot?'sig':'')}</td>
      <td class="ort">${cip('ClaudeBot '+(b.claudebot||0), b.claudebot?'sig':'')}</td><td class="ort">${cip('Perplexity '+(b.perplexitybot||0), b.perplexitybot?'sig':'')}</td>
      <td class="ort">${cip('Google '+(b.google||0), b.google?'sig':'')}</td><td class="ort" style="color:var(--muted)">${b.sonZiyaret||'–'}</td></tr>`; };
    return bolumBaslik('GEO / AI','AI Bot Takibi','ChatGPT/Claude/Perplexity botları siteni taradı mı (sunucu logundan).') + filtreBar() +
      `<div class="tablo-kap"><table class="tablo" style="min-width:660px"><thead><tr><th>Site</th><th class="ort">OpenAI</th><th class="ort">Anthropic</th><th class="ort">Perplexity</th><th class="ort">Google</th><th class="ort">Son ziyaret</th></tr></thead><tbody>${siteler().map(satir).join('')}</tbody></table></div>`;
  },

  degisim(){
    const list = VERI.degisiklikler||[];
    const renk={dusus:'bad','yeni-kirik':'bad',artis:'ok','yeni-sayfa':'sig'};
    const ik={dusus:'▼','yeni-kirik':'⚠',artis:'▲','yeni-sayfa':'＋'};
    const satir=(d)=>`<div class="li"><span class="t-${renk[d.tip]||'mut'}" style="font-size:12px">${ik[d.tip]||'•'}</span>
      <div class="txt">${d.mesaj}<s>[${d.site}] · ${d.tarih}</s></div></div>`;
    return bolumBaslik('Genel','Değişiklik İzleyici','İki tarama arası farklar: düşen puan, yeni kırık link, sıralama değişimi.') +
      (list.length?`<div class="liste">${list.map(satir).join('')}</div>`:bosDurum('Son taramada değişiklik yok.'));
  },

  uyarilar(){
    return bolumBaslik('Genel','Uyarılar','SSL bitişi, site çöküşü, kırık link ve denetim sorunları.') + filtreBar() + uyariBloku(VERI.uyarilar, true);
  },

  raporlar(){
    const list = VERI.raporlar||[];
    // r.dosya varsa rapor gercekten uretilmis demektir (npm run rapor) -> yeni sekmede acilir,
    // PDF'i raporun kendi "PDF kaydet" dugmesi verir. Dosyasi olmayan eski kayitlar pasif kalir.
    const kart=(r)=>`<div class="karo" style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div><p style="font-family:var(--disp);font-weight:600;margin:0">${r.ad}</p><p style="font-size:11px;color:var(--faint);margin:2px 0 0">${r.tur} · ${r.tarih}</p></div>
      ${r.dosya
        ? `<a class="btn mini" href="${r.dosya}" target="_blank" rel="noopener">Aç / PDF</a>`
        : `<button class="btn mini" disabled style="opacity:.5" title="Bu kayıt için dosya yok — npm run rapor ile yeniden üret">dosya yok</button>`}</div>`;
    return bolumBaslik('Çıktı','Raporlar','Otomatik haftalık özet + indirilebilir raporlar.') +
      `<div class="kart" style="margin-bottom:18px"><p style="font-family:var(--disp);font-weight:600;margin:0 0 7px"><span class="t-sig">✦</span> Haftalık Akıllı Özet</p>
        <p style="font-size:13.5px;color:var(--muted);line-height:1.6;margin:0">${haftalikOzetUret()}</p></div>` +
      `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${list.map(kart).join('')||bosDurum('Henüz rapor yok — bilgisayarında "npm run rapor" çalıştır.')}</div>` +
      `<p style="font-size:11.5px;color:var(--faint);margin:14px 0 0">Yeni rapor: <code>npm run rapor</code> (haftalık) · <code>npm run rapor -- aylik</code> · tek site için <code>npm run rapor -- --site=animare</code></p>`;
  },

  araclar(){
    const s = aracSite(); if(!s) return bosDurum('Önce site tanımla.');
    const alan = (baslik,acik,id,icerik)=>`<div class="kart" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <p style="font-family:var(--disp);font-weight:600;margin:0">${baslik}</p><button class="btn mini" onclick="kopyala('${id}',this)">Kopyala</button></div>
      <p style="font-size:11px;color:var(--faint);margin:0 0 8px">${acik}</p><textarea id="${id}" class="alan" readonly rows="7">${String(icerik).replace(/</g,'&lt;')}</textarea></div>`;
    return bolumBaslik('Çıktı','Araçlar','Hazır dosya üreticiler — kopyala, sitene yapıştır. Ücretsiz.') +
      `<div class="kart" style="margin-bottom:18px"><label class="fl">Site seç:</label>
        <select id="arac-site" class="alan" style="width:auto;display:inline-block;margin-left:8px" onchange="aracDegis()">${(VERI.siteler||[]).map(x=>`<option value="${x.id}" ${x.id===s.id?'selected':''}>${x.ad}</option>`).join('')}</select></div>` +
      alan('llms.txt','AI asistanlarının siteni doğru özetlemesi için. Site köküne /llms.txt koy.','out-llms',uretLlms(s)) +
      alan('robots.txt — AI bot erişimi','AI botlarına izin ver (GEO için şart). robots.txt\'e ekle.','out-robots',uretRobots(s)) +
      alan('Schema (JSON-LD)','LocalBusiness yapısal veri. ___ alanlarını doldur, head bölümüne koy.','out-schema',uretSchema(s));
  },

  ayarlar(){
    const duzenlenir = API_VAR === true;
    const liste = SITE_CFG || VERI.siteler || [];
    const eylem=(s)=> duzenlenir
      ? `<td class="ort" style="white-space:nowrap"><button class="btn mini" onclick="siteDurum('${s.id}',${!s.aktif})">${s.aktif?'pasife al':'aktif et'}</button>
         <button class="btn mini" style="margin-left:5px;color:var(--bad)" onclick="siteSil('${s.id}')">sil</button></td>` : '';
    const site=(s)=>`<tr><td class="site-ad">${s.ad}</td><td style="color:var(--signal)">${kisaUrl(s.url)||'<span style=\"color:var(--faint)\">— (yakında)</span>'}</td><td class="ort">${s.aktif?cip('aktif','ok'):cip('pasif','')}</td>${eylem(s)}</tr>`;
    return bolumBaslik('Çıktı','Ayarlar','Site tanımları ve otomasyon. Kaynak: sites.config.json') +
      `<div class="tablo-kap" style="margin-bottom:18px"><div class="tablo-bas">Tanımlı siteler<span style="font-size:11px;color:var(--faint)">${
        duzenlenir ? 'sites.config.json — düzenlenebilir (npm run panel)' : 'sites.config.json — yayın sürümü salt-okunur'}</span></div>
        <table class="tablo" style="min-width:420px"><thead><tr><th>Ad</th><th>URL</th><th class="ort">Durum</th>${duzenlenir?'<th class="ort">İşlem</th>':''}</tr></thead><tbody>${liste.map(site).join('')}</tbody></table></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
        ${karo('Otomasyon','GitHub Actions','her gece tarar — ücretsiz')}
        ${karo('Yayın','FileZilla / FTP','statik — sunucu yok')}
        ${karo('Veri','data.json','tek kaynak')}</div>`;
  },
};

function uyariBloku(list, tam){
  if(!list || !list.length) return tam?bosDurum('Aktif uyarı yok. Her şey yolunda.'):'';
  const filtreli = SECILI_SITE ? list.filter(u=>u.site===SECILI_SITE) : list;
  if(!filtreli.length) return bosDurum('Bu sitede uyarı yok.');
  const satir=(u)=>`<div class="li"><span class="t-${u.seviye==='kritik'?'bad':'warn'}" style="font-size:12px">${u.seviye==='kritik'?'●':'▲'}</span>
    <div class="txt"><span style="color:var(--faint)">[${u.site}]</span> ${u.mesaj}</div></div>`;
  return `<div class="liste">${filtreli.map(satir).join('')}</div>`;
}

// ============ YÖNLENDİRME ============
function menuCiz(){
  const buton=(m)=>{
    let rz='';
    if(m.id==='uyarilar' && VERI.uyarilar?.length) rz=`<span class="rz rz-bad">${VERI.uyarilar.length}</span>`;
    else if(m.id==='degisim' && VERI.degisiklikler?.length) rz=`<span class="rz rz-info">${VERI.degisiklikler.length}</span>`;
    else if(m.id==='oneri') rz=`<span class="rz rz-warn">${tumOneriler().length}</span>`;
    return `<button class="nav-btn" data-id="${m.id}" data-ad="${m.ad}" onclick="git('${m.id}')"><span class="ik">${m.ik}</span><span>${m.ad}</span>${rz}</button>`;
  };
  el('nav').innerHTML = MENU_GRUPLARI.map(g=>`<p class="nav-grup">${g.grup}</p>`+g.items.map(buton).join('')).join('');
}

function git(id){
  AKTIF = id;
  const m = MENU.find(x=>x.id===id);
  el('sayfaBaslik').textContent = m.ad;
  document.querySelectorAll('#nav .nav-btn').forEach(b=> b.classList.toggle('aktif', b.dataset.id===id));
  el('icerik').innerHTML = VIEWS[id] ? VIEWS[id]() : bosDurum('bölüm bulunamadı');
  el('icerik').scrollTop = 0;
  menuKapat();
}
window.git = git;

function aramaYap(v){ ARAMA=(v||'').toLowerCase().trim(); git(AKTIF); }
window.aramaYap = aramaYap;
function menuAc(){ el('yanmenu').classList.add('acik'); el('perde').classList.add('acik'); }
function menuKapat(){ if(window.innerWidth<=640){ el('yanmenu').classList.remove('acik'); el('perde').classList.remove('acik'); } }
function menuDaralt(){ document.body.classList.toggle('dar'); localStorage.setItem('seotakip_dar', document.body.classList.contains('dar')?'1':''); }
window.menuAc=menuAc; window.menuKapat=menuKapat; window.menuDaralt=menuDaralt;
// ============ SITE EKLEME ============
// Yerelde (npm run panel) yonetim API'si acikitr -> form dogrudan sites.config.json'a yazar.
// Yayindaki statik surumde API yoktur -> ayni form, yapistirilacak JSON blogunu uretir.

function modalKapat(){ el('modal').innerHTML=''; document.removeEventListener('keydown', modalEsc); }
function modalEsc(e){ if(e.key==='Escape') modalKapat(); }
function modalAc(icerik){
  el('modal').innerHTML = `<div class="modal-arka" onclick="if(event.target===this)modalKapat()">
    <div class="modal" role="dialog" aria-modal="true" aria-label="Yeni site ekle">${icerik}</div></div>`;
  document.addEventListener('keydown', modalEsc);
}
window.modalKapat = modalKapat;

let API_VAR = null;   // null = henuz bakilmadi
let SITE_CFG = null;  // API varken sites.config.json'un canli hali
async function apiVarMi(){
  if(API_VAR !== null) return API_VAR;
  if(location.protocol === 'file:') return (API_VAR = false);
  API_VAR = await siteCfgYenile();
  return API_VAR;
}
async function siteCfgYenile(){
  try{
    const r = await fetch('api/siteler', { cache:'no-store' });
    const d = r.ok ? await r.json() : null;
    if(!d?.yazilabilir) return false;
    SITE_CFG = d.siteler || [];
    return true;
  }catch{ return false; }
}

// scripts/lib/siteler.js ile ayni kurallar (statik surumde blok uretmek icin)
function urlDuzelt(girdi){
  let s = String(girdi||'').trim();
  if(!s) throw new Error('Adres boş olamaz.');
  if(!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u; try{ u = new URL(s); }catch{ throw new Error('Geçersiz adres: ' + girdi); }
  if(!u.hostname.includes('.')) throw new Error('Geçersiz alan adı: ' + u.hostname);
  return u.origin;
}
const kokHost = (u)=> new URL(u).hostname.replace(/^www\./,'');
function idUret(url, mevcut=[]){
  const taban = kokHost(url).split('.')[0].replace(/[^a-z0-9]+/gi,'').toLowerCase() || 'site';
  let id = taban, n = 2;
  while(mevcut.includes(id)) id = taban + (n++);
  return id;
}
const adUret = (url)=> kokHost(url).split('.')[0].replace(/[-_]+/g,' ').replace(/\b\w/g, c=>c.toUpperCase());

async function siteEkle(){
  const canli = await apiVarMi();
  const alan = (id,etiket,ipucu,deger='')=>`<label class="fl" for="${id}">${etiket}</label>
    <input id="${id}" class="alan" style="margin:4px 0 11px" placeholder="${ipucu}" value="${deger}" onkeydown="if(event.key==='Enter')siteEkleGonder()" />`;
  modalAc(`
    <p style="font-family:var(--disp);font-weight:600;margin:0 0 3px">Yeni site ekle</p>
    <p style="font-size:11px;color:var(--faint);margin:0 0 15px">${canli
      ? 'sites.config.json dosyasına doğrudan yazılır'
      : 'yayındaki panel salt-okunur — hazır blok üretilir, sites.config.json’a yapıştır'}</p>
    ${alan('se-url','Adres *','ornek.com')}
    ${alan('se-ad','Ad (boşsa adresten üretilir)','Örnek Site')}
    ${alan('se-dil','Diller (virgülle)','tr, en','tr')}
    ${alan('se-not','Not (opsiyonel)','WordPress / Next.js …')}
    ${canli ? `<label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted);margin:2px 0 4px">
      <input type="checkbox" id="se-tara" /> ekledikten sonra taramayı başlat</label>` : ''}
    <p id="se-hata" style="display:none;color:var(--bad);font-size:12.5px;margin:8px 0 0"></p>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:15px">
      <button class="btn" onclick="modalKapat()">Vazgeç</button>
      <button class="btn primary" id="se-gonder" onclick="siteEkleGonder()">${canli?'Ekle':'Blok üret'}</button>
    </div>`);
  el('se-url').focus();
}
window.siteEkle = siteEkle;
window.siteEkleBilgi = siteEkle; // eski buton adi

async function siteEkleGonder(){
  const hataGoster = (m)=>{ const h=el('se-hata'); h.textContent=m; h.style.display='block'; };
  const g = {
    url: el('se-url').value, ad: el('se-ad').value.trim(),
    diller: el('se-dil').value, not: el('se-not').value.trim(),
    tara: !!el('se-tara')?.checked,
  };
  let tamUrl;
  try{ tamUrl = urlDuzelt(g.url); }catch(e){ return hataGoster(e.message); }
  const mevcut = SITE_CFG || VERI.siteler || [];
  const cakisan = mevcut.find(s=> s.url && kokHost(s.url) === kokHost(tamUrl));
  if(cakisan) return hataGoster(`Bu adres zaten kayıtlı: ${cakisan.ad}`);

  const btn = el('se-gonder'); btn.disabled = true; btn.textContent = 'kaydediliyor…';
  if(await apiVarMi()){
    try{
      const r = await fetch('api/siteler', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(g) });
      const d = await r.json();
      if(!r.ok) throw new Error(d.hata || ('http ' + r.status));
      await siteCfgYenile();
      return siteEklendiEkrani(d.site, d.tarama);
    }catch(e){
      btn.disabled = false; btn.textContent = 'Ekle';
      return hataGoster('Eklenemedi: ' + e.message);
    }
  }
  // statik surum: yapistirilacak blogu uret
  const diller = g.diller.split(',').map(d=>d.trim().toLowerCase()).filter(Boolean);
  siteEklendiEkrani({
    id: idUret(tamUrl, mevcut.map(s=>s.id)),
    ad: g.ad || adUret(tamUrl), url: tamUrl, aktif: true,
    diller: diller.length ? [...new Set(diller)] : ['tr'], not: g.not,
  }, null, true);
}
window.siteEkleGonder = siteEkleGonder;

async function siteYonet(id, ayar){
  try{
    const r = await fetch('api/siteler/' + encodeURIComponent(id), ayar);
    const d = await r.json();
    if(!r.ok) throw new Error(d.hata || ('http ' + r.status));
    await siteCfgYenile();
    git('ayarlar');
  }catch(e){ alert('İşlem başarısız: ' + e.message); }
}
const siteDurum = (id, aktif)=> siteYonet(id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ aktif }) });
function siteSil(id){
  const s = (SITE_CFG||[]).find(x=>x.id===id);
  if(!confirm(`${s?.ad || id} sites.config.json'dan tamamen silinsin mi?`)) return;
  return siteYonet(id, { method:'DELETE' });
}
window.siteDurum = siteDurum; window.siteSil = siteSil;

function siteEklendiEkrani(site, tarama, sadeceBlok){
  const blok = JSON.stringify(site, null, 2).replace(/</g,'&lt;');
  modalAc(`
    <p style="font-family:var(--disp);font-weight:600;margin:0 0 3px">
      <span class="t-ok">${sadeceBlok?'◧':'✓'}</span> ${site.ad}</p>
    <p style="font-size:11px;color:var(--faint);margin:0 0 13px">${sadeceBlok
      ? 'Bu bloğu bilgisayarındaki sites.config.json → "siteler" dizisine ekle, sonra: npm run tara-hepsi && npm run build'
      : 'sites.config.json güncellendi.' + (tarama?.baslatildi ? ' Tarama başladı; bitince paneli yenile.' : ' Sırada: npm run tara-hepsi && npm run build')}</p>
    <div style="text-align:right;margin-bottom:5px"><button class="btn mini" onclick="kopyala('se-blok',this)">Kopyala</button></div>
    <textarea id="se-blok" class="alan" readonly rows="8">${blok}</textarea>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn" onclick="siteEkle()">Bir tane daha</button>
      <button class="btn primary" onclick="modalKapat();git('ayarlar')">Tamam</button>
    </div>`);
}

// ============ BAŞLAT ============
async function veriYukle(){
  try{
    const r = await fetch('data/data.json',{cache:'no-store'});
    if(!r.ok) throw new Error('http '+r.status);
    const d = await r.json();
    if(!d._not) el('veriRozet').style.display='none';
    return d;
  }catch(e){ if(window.SEO_FALLBACK) return window.SEO_FALLBACK; throw e; }
}
(async()=>{
  try{
    if(localStorage.getItem('seotakip_dar')) document.body.classList.add('dar'); // daralt tercihini hatirla
    VERI = await veriYukle();
    await apiVarMi(); // yerel panelde site ekleme/silme acilir; yayinda sessizce kapali kalir
    const t = new Date(VERI.guncelleme);
    el('menuGuncelleme').textContent = 'son tarama: ' + (isNaN(t)?VERI.guncelleme:t.toLocaleString('tr-TR'));
    menuCiz(); git('genel');
  }catch(e){ el('icerik').innerHTML = bosDurum('Veri yüklenemedi. Panel\'i sunucuyla aç: npx serve · ('+e.message+')'); }
})();
