// SEO/GEO Nöbet Paneli — cizim katmani (mekanik/kontrol-odasi temasi)
// Tek veri kaynagi: data/data.json (file:// ise assets/fallback-data.js).

const el = (id) => document.getElementById(id);
let VERI = null, AKTIF = 'genel', ARAMA = '', SECILI_SITE = '';

// ---- menu (gruplu) ----
const MENU_GRUPLARI = [
  { grup: 'Genel', items: [
    { id:'genel', ad:'Genel Bakış', ik:'▣' },
    { id:'oneri', ad:'Öneriler', ik:'★' },
    { id:'siteler', ad:'Siteler', ik:'❏' },
    { id:'degisim', ad:'Değişiklik İzleyici', ik:'⇄' },
    { id:'uyarilar', ad:'Uyarılar', ik:'!' },
  ]},
  { grup:'Teknik SEO', items:[
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
const FILTRELI = new Set(['genel','oneri','siteler','denetim','kirik','hiz','iclink','indeks','kelime','gap','rakip','geo','botlar','uyarilar']);

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

function bolumBaslik(eyebrow, baslik, aciklama){
  return `<div class="bolum-baslik"><div class="eyebrow">${eyebrow}</div><h2>${baslik}</h2><p>${aciklama}</p></div>`;
}
const bosDurum = (m)=> `<div class="bos">${m}</div>`;
const asamaRozeti = (n)=> `<span class="asama">Aşama ${n}</span>`;
const stBaslik = (baslik, sayi, more)=> `<div class="st"><h3>${baslik}</h3>${sayi!=null?`<span class="count">${sayi}</span>`:''}${more?`<button class="more" onclick="${more}">tümü →</button>`:''}</div>`;

// site filtresi
function filtreBar(){
  const c = (id,ad)=>`<button class="fcip ${SECILI_SITE===id?'aktif':''}" onclick="siteSec('${id}')">${ad}</button>`;
  return `<div class="filtre"><span class="fl">Site</span>${c('','Tümü')}${(VERI.siteler||[]).map(s=>c(s.id,s.ad)).join('')}</div>`;
}
function siteSec(id){ SECILI_SITE = id; git(AKTIF); }
window.siteSec = siteSec;

const siteler = ()=> (VERI?.siteler||[]).filter(s =>
  (!SECILI_SITE || s.id===SECILI_SITE) && (!ARAMA || (s.ad+s.url).toLowerCase().includes(ARAMA)));

// ============ ÖNERİ / DEĞERLENDİRME MOTORU ============
const ONCELIK_SIRA = { kritik:0, yuksek:1, orta:2, dusuk:3 };
const ETKI = { kritik:4, yuksek:3, orta:2, dusuk:1 };
const EFOR = {
  'SSL':1,'Kirik link':1,'Sitemap':1,'Meta':1,'Gorsel alt':1,'Olcum':1,'Schema':1,'AI bot':1,
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
  if (s.kirikLinkler?.length) ekle('Kirik link','yuksek', `${s.kirikLinkler.length} kırık link — 404'leri düzelt veya yönlendir.`);
  if (!s.schema?.gecerli) ekle('Schema','orta','JSON-LD schema yok — LocalBusiness/Organization ekle.');
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
  else if (s.indeks?.indekssiz>0) ekle('Indeks','dusuk', `${s.indeks.indekssiz} sayfa indekslenmemiş — nedenini incele.`);
  if (s.aiBotlar){ const b=s.aiBotlar; if (((b.gptbot||0)+(b.claudebot||0)+(b.perplexitybot||0))<20) ekle('AI bot','orta','AI botları siteni az tarıyor — llms.txt ekle, robots\'ta izin ver.'); }
  if (s.geo && s.geo.chatgpt===false && s.geo.perplexity===false && s.geo.gemini===false) ekle('GEO','orta','Hiçbir AI motorunda görünmüyorsun — schema + net cevap formatlı içerik gerek.');
  (s.siralama||[]).forEach(k=>{
    if (k.pozisyon>=4 && k.pozisyon<=10 && (k.gosterim||0)>=500) ekle('Kelime firsati','yuksek', `"${k.kelime}" #${k.pozisyon} + yüksek gösterim — az itmeyle ilk 3'e girer.`);
    else if (k.pozisyon>=11 && k.pozisyon<=20) ekle('Kelime firsati','orta', `"${k.kelime}" #${k.pozisyon} (2. sayfa) — içeriği güçlendir.`);
    if (k.onceki && k.pozisyon>k.onceki) ekle('Kelime dususu','orta', `"${k.kelime}" ${k.onceki}→${k.pozisyon} düştü — incele.`);
  });
  (s.kanibalizasyon||[]).forEach(k=> ekle('Kanibalizasyon','orta', `"${k.kelime}" için ${k.sayfalar.length} sayfa yarışıyor — birini ana yap, diğerlerini birleştir.`));
  (s.icerikBoslugu||[]).forEach(g=> ekle('Icerik boslugu', g.hacim>=500?'yuksek':'orta', `"${g.kelime}" (~${g.hacim} gösterim) — içeriği güçlendir/yaz.`));
  return o;
}
const tumOneriler = ()=> siteler().flatMap(oneriUret).sort((a,b)=> ONCELIK_SIRA[a.oncelik]-ONCELIK_SIRA[b.oncelik]);
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

function haftalikOzetUret(){
  const t = tumOneriler();
  const k = t.filter(o=>o.oncelik==='kritik').length, y = t.filter(o=>o.oncelik==='yuksek').length, hizli = t.filter(o=>o.hizliKazanim).length;
  const deg = VERI.degisiklikler||[];
  const artis = deg.filter(d=>d.tip==='artis'), dusus = deg.filter(d=>d.tip==='dusus'||d.tip==='yeni-kirik');
  let s = `Bu hafta ${(VERI.siteler||[]).length} site takip edildi; ortalama SEO puanı ${VERI.ozet?.ortalamaSeoPuan}/100. `;
  s += k ? `${k} kritik ve ${y} yüksek öncelikli sorun var — önce bunları kapat. ` : `Kritik sorun yok; ${y} yüksek öncelikli madde var. `;
  if(hizli) s += `${hizli} adet hızlı kazanım (yüksek etki, kolay) var. `;
  if(artis.length) s += `Olumlu: ${artis.map(a=>a.mesaj).join('; ')}. `;
  if(dusus.length) s += `Dikkat: ${dusus.map(a=>a.mesaj).join('; ')}. `;
  const ilk3 = t.slice(0,3).map(a=>`(${a.site}) ${a.mesaj}`).join('  |  ');
  if(ilk3) s += `Önerilen ilk 3 aksiyon: ${ilk3}`;
  return s;
}

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
      </div>${tbadge(s.seo?.trend)}
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
        <div><div class="site-ad">${s.ad}</div><a href="${s.url}" target="_blank" style="font-size:12px;color:var(--signal)">${kisaUrl(s.url)}</a></div></div></td>
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
      <td class="ort">${vc(h.lcp,2.5,4,' s')}</td><td class="ort">${vc(h.inp,200,500,' ms')}</td><td class="ort">${vc(h.cls,0.1,0.25,'')}</td></tr>`; };
    return bolumBaslik('Teknik SEO','Hız / Core Web Vitals','LCP, INP, CLS + mobil/masaüstü. Google PageSpeed API.') + filtreBar() +
      `<div class="tablo-kap"><table class="tablo" style="min-width:560px"><thead><tr>
        <th>Site</th><th class="ort">Mobil</th><th class="ort">Masaüstü</th><th class="ort">LCP</th><th class="ort">INP</th><th class="ort">CLS</th>
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
    const satir=(s)=>{ const i=s.indeks; if(!i) return `<tr><td class="site-ad">${s.ad}</td><td class="ort" colspan="3" style="color:var(--faint)">veri yok (Search Console)</td></tr>`;
      return `<tr><td class="site-ad">${s.ad}</td><td class="ort t-ok">${i.indeksli}</td><td class="ort ${i.indekssiz?'t-warn':''}">${i.indekssiz}</td>
      <td class="ort">${i.dususVar?cip('düşüş var','bad'):cip('stabil','ok')}</td></tr>`; };
    return bolumBaslik('Teknik SEO','İndeks Monitörü','Sayfalar Google\'da indeksli mi. Search Console verisi.') + filtreBar() +
      `<div class="tablo-kap"><table class="tablo" style="min-width:480px"><thead><tr>
        <th>Site</th><th class="ort">İndeksli</th><th class="ort">İndekssiz</th><th class="ort">Durum</th>
      </tr></thead><tbody>${siteler().map(satir).join('')}</tbody></table></div>`;
  },

  kelime(){
    const bloklar = siteler().map(s=>{ const list=s.siralama||[]; if(!list.length) return '';
      const satir=(k)=>{ const yon=k.pozisyon<k.onceki?'▲':k.pozisyon>k.onceki?'▼':'–'; const rk=k.pozisyon<k.onceki?'t-ok':k.pozisyon>k.onceki?'t-bad':'t-mut';
        return `<tr><td>${k.kelime}</td><td class="ort" style="font-family:var(--disp);font-weight:600">#${k.pozisyon}</td>
        <td class="ort ${rk}">${yon} ${Math.abs((k.onceki||k.pozisyon)-k.pozisyon)||''}</td><td class="ort" style="color:var(--muted)">${k.gosterim??'–'}</td>
        <td class="ort" style="color:var(--muted)">${k.tik??'–'}</td></tr>`; };
      return `<div class="tablo-kap" style="margin-bottom:14px"><div class="tablo-bas">${s.ad}</div>
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
      return `<div class="tablo-kap" style="margin-bottom:14px"><div class="tablo-bas">${s.ad}</div>
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
    const oneriSatir = (f,i)=>`<tr><td>${f.kelime}</td><td style="color:var(--muted)">${f.site}</td><td class="ort">${cip('#'+f.poz,'warn')}</td>
      <td class="ort"><input id="cmd-${i}" class="gizli" value='node scripts/aiblog.js ${f.siteId} "${f.kelime}"'><button class="btn mini" onclick="kopyala('cmd-${i}',this)">komutu kopyala</button></td></tr>`;
    const kart = (c,i)=>`<div class="kart" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:12px">
      <div><p style="font-family:var(--disp);font-weight:600;margin:0">${c.baslik}</p><p style="font-size:11px;color:var(--faint);margin:2px 0 0">${c.site} · "${c.kelime}" · ${c.kelimeSayisi} kelime · ${c.tarih}${c.kaynak?' · '+c.kaynak:''}</p></div>
      <button class="btn mini" onclick="document.getElementById('body-${i}').classList.toggle('gizli')">göster/gizle</button></div>
      <p style="font-size:12.5px;color:var(--muted);margin:9px 0 0">${c.metaAciklama||''}</p>
      <div id="body-${i}" class="gizli" style="margin-top:11px"><div style="text-align:right;margin-bottom:5px"><button class="btn mini" onclick="kopyala('md-${i}',this)">markdown kopyala</button></div>
        <textarea id="md-${i}" class="alan" readonly rows="12">${(c.govde||'').replace(/</g,'&lt;')}</textarea></div></div>`;
    return bolumBaslik('İçerik & Sıralama','AI İçerik / Auto SEO Blog','SEO uyumlu içerik üret. Fırsat kelimelerine göre konu önerisi + üretilen yazılar.') +
      `<div class="kart" style="margin-bottom:18px;font-size:13.5px;color:var(--muted);line-height:1.6">
        <p style="color:var(--text);font-weight:600;margin:0 0 4px">Nasıl çalışır?</p>
        <b>A — Claude ile (önerilen):</b> Bu Claude oturumunda "&lt;site&gt; için '&lt;kelime&gt;' içeriği yaz" de. SEO skill'iyle üretir, panele ekler.<br>
        <b>B — Gemini ile:</b> <code style="color:var(--signal)">.env</code>'e <code style="color:var(--signal)">GEMINI_API_KEY</code> ekle, aşağıdan komutu kopyala.</div>` +
      stBaslik('Önerilen konular', firsatlar.length) +
      (firsatlar.length ? `<div class="tablo-kap"><table class="tablo" style="min-width:520px"><thead><tr><th>Kelime</th><th>Site</th><th class="ort">Poz</th><th class="ort">Üret</th></tr></thead><tbody>${firsatlar.map(oneriSatir).join('')}</tbody></table></div>` : bosDurum('Fırsat kelimesi yok — Search Console bağla.')) +
      stBaslik('Üretilen içerikler', uretilen.length) +
      (uretilen.length ? uretilen.map(kart).join('') : bosDurum('Henüz içerik üretilmedi.'));
  },

  geo(){
    const k = ['chatgpt','perplexity','gemini'], ad = {chatgpt:'ChatGPT',perplexity:'Perplexity',gemini:'Gemini'};
    const satir=(s)=> `<tr><td class="site-ad">${s.ad}</td>${k.map(x=>`<td class="ort">${s.geo?(s.geo[x]?cip('görülüyor','sig'):cip('yok','')):cip('ölçülmedi','mut')}</td>`).join('')}</tr>`;
    const detay = siteler().flatMap(s=>(s.geoDetay||[]).map(d=>({s:s.ad,...d})));
    return bolumBaslik('GEO / AI','GEO Görünürlük','Marka AI motorlarında (ChatGPT/Perplexity/Gemini) çıkıyor mu.') + filtreBar() +
      `<div class="tablo-kap"><table class="tablo" style="min-width:480px"><thead><tr><th>Site</th>${k.map(x=>`<th class="ort">${ad[x]}</th>`).join('')}</tr></thead><tbody>${siteler().map(satir).join('')}</tbody></table></div>` +
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
    const kart=(r)=>`<div class="karo" style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div><p style="font-family:var(--disp);font-weight:600;margin:0">${r.ad}</p><p style="font-size:11px;color:var(--faint);margin:2px 0 0">${r.tur} · ${r.tarih}</p></div>
      <button class="btn mini" disabled style="opacity:.5">PDF (Aşama 5)</button></div>`;
    return bolumBaslik('Çıktı','Raporlar','Otomatik haftalık özet + indirilebilir raporlar.') +
      `<div class="kart" style="margin-bottom:18px"><p style="font-family:var(--disp);font-weight:600;margin:0 0 7px"><span class="t-sig">✦</span> Haftalık Akıllı Özet</p>
        <p style="font-size:13.5px;color:var(--muted);line-height:1.6;margin:0">${haftalikOzetUret()}</p></div>` +
      `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${list.map(kart).join('')||bosDurum('Henüz rapor yok.')}</div>`;
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
    const site=(s)=>`<tr><td class="site-ad">${s.ad}</td><td style="color:var(--signal)">${kisaUrl(s.url)||'<span style=\"color:var(--faint)\">— (yakında)</span>'}</td><td class="ort">${s.aktif?cip('aktif','ok'):cip('pasif','')}</td></tr>`;
    return bolumBaslik('Çıktı','Ayarlar','Site tanımları ve otomasyon. Kaynak: sites.config.json') +
      `<div class="tablo-kap" style="margin-bottom:18px"><div class="tablo-bas">Tanımlı siteler<span style="font-size:11px;color:var(--faint)">sites.config.json</span></div>
        <table class="tablo" style="min-width:420px"><thead><tr><th>Ad</th><th>URL</th><th class="ort">Durum</th></tr></thead><tbody>${(VERI.siteler||[]).map(site).join('')}</tbody></table></div>
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
    return `<button class="nav-btn" data-id="${m.id}" onclick="git('${m.id}')"><span class="ik">${m.ik}</span><span>${m.ad}</span>${rz}</button>`;
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
window.menuAc=menuAc; window.menuKapat=menuKapat;
function siteEkleBilgi(){ git('ayarlar'); alert('Yeni site: sites.config.json dosyasındaki "siteler" dizisine blok ekleyip aktif:true yap. Panel ve tüm script\'ler otomatik kapsar.'); }
window.siteEkleBilgi = siteEkleBilgi;

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
    VERI = await veriYukle();
    const t = new Date(VERI.guncelleme);
    el('menuGuncelleme').textContent = 'son tarama: ' + (isNaN(t)?VERI.guncelleme:t.toLocaleString('tr-TR'));
    menuCiz(); git('genel');
  }catch(e){ el('icerik').innerHTML = bosDurum('Veri yüklenemedi. Panel\'i sunucuyla aç: npx serve · ('+e.message+')'); }
})();
