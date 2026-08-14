// SEO/GEO Takip Paneli - yonetim bari + bolum yonlendirme + cizim
// Tek veri kaynagi: data/data.json (file:// ise assets/fallback-data.js).

const el = (id) => document.getElementById(id);
let VERI = null;
let AKTIF = 'genel';
let ARAMA = '';

// ---- menu tanimi (gruplu) ----
const MENU_GRUPLARI = [
  { grup: 'Genel', items: [
    { id: 'genel',    ad: 'Genel Bakis',        ikon: '▣' },
    { id: 'oneri',    ad: 'Oneriler / Aksiyon', ikon: '★' },
    { id: 'siteler',  ad: 'Siteler',            ikon: '❏' },
    { id: 'degisim',  ad: 'Degisiklik Izleyici',ikon: '⇄' },
    { id: 'uyarilar', ad: 'Uyarilar',           ikon: '!' },
  ]},
  { grup: 'Teknik SEO', items: [
    { id: 'denetim',  ad: 'SEO Denetim',        ikon: '✓' },
    { id: 'kirik',    ad: 'Kirik Linkler',      ikon: '⚿' },
    { id: 'hiz',      ad: 'Hiz / Core Vitals',  ikon: '⚡' },
    { id: 'iclink',   ad: 'Ic Linkleme',        ikon: '⋔' },
    { id: 'indeks',   ad: 'Indeks Monitoru',    ikon: '⊞' },
  ]},
  { grup: 'Icerik & Siralama', items: [
    { id: 'kelime',   ad: 'Anahtar Kelime',     ikon: '#' },
    { id: 'gap',      ad: 'Icerik Boslugu',     ikon: '◫' },
    { id: 'rakip',    ad: 'Rakip Analizi',      ikon: '⚔' },
    { id: 'icerik',   ad: 'AI Icerik / Blog',   ikon: '✎' },
  ]},
  { grup: 'GEO / AI', items: [
    { id: 'geo',      ad: 'GEO Gorunurluk',     ikon: '◎' },
    { id: 'botlar',   ad: 'AI Bot Takibi',      ikon: '⟲' },
  ]},
  { grup: 'Cikti', items: [
    { id: 'raporlar', ad: 'Raporlar',           ikon: '▤' },
    { id: 'araclar',  ad: 'Araclar',            ikon: '⚒' },
    { id: 'ayarlar',  ad: 'Ayarlar',            ikon: '⚙' },
  ]},
];
const MENU = MENU_GRUPLARI.flatMap(g => g.items);

// ============ YARDIMCILAR ============
const trendRenk = (t) => t?.startsWith('+') ? 'text-emerald-400' : t?.startsWith('-') ? 'text-rose-400' : 'text-slate-400';
const puanRenk  = (p) => p >= 80 ? 'text-emerald-400' : p >= 65 ? 'text-amber-400' : 'text-rose-400';
const puanHalka = (p) => p >= 80 ? '#34d399' : p >= 65 ? '#fbbf24' : '#fb7185';
const kisaUrl   = (u) => (u || '').replace(/^https?:\/\//, '');

function chip(metin, renk) {
  const r = {
    emerald:'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    amber:'bg-amber-500/10 text-amber-300 border-amber-500/20',
    rose:'bg-rose-500/10 text-rose-300 border-rose-500/20',
    slate:'bg-slate-700/40 text-slate-300 border-slate-600/40',
    violet:'bg-violet-500/10 text-violet-300 border-violet-500/20',
  };
  return `<span class="text-[11px] px-2 py-0.5 rounded-md border ${r[renk]||r.slate}">${metin}</span>`;
}
const durumChip = (ok, iyi, kotu) => ok ? chip(iyi,'emerald') : chip(kotu,'rose');

function sslChip(ssl){
  if(!ssl?.gecerli) return chip('SSL yok','rose');
  const g = ssl.kalanGun;
  return chip('SSL '+g+'g', g<=14?'rose':g<=30?'amber':'emerald');
}

function karo(baslik, deger, alt, renk){
  return `<div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
    <p class="text-xs text-slate-400 mb-1">${baslik}</p>
    <p class="text-2xl font-semibold ${renk||'text-white'}">${deger}</p>
    <p class="text-xs text-slate-500 mt-1">${alt||''}</p></div>`;
}

function halkaSVG(p){
  const r=26, c=2*Math.PI*r, dash=(p/100)*c;
  return `<svg width="60" height="60" viewBox="0 0 64 64" class="shrink-0">
    <circle cx="32" cy="32" r="${r}" fill="none" stroke="#1e293b" stroke-width="6"/>
    <circle cx="32" cy="32" r="${r}" fill="none" stroke="${puanHalka(p)}" stroke-width="6"
      stroke-linecap="round" stroke-dasharray="${dash} ${c}" transform="rotate(-90 32 32)"/>
    <text x="32" y="37" text-anchor="middle" font-size="15" font-weight="600" fill="#e2e8f0">${p}</text></svg>`;
}

function bolumBaslik(baslik, aciklama){
  return `<div class="mb-5"><h2 class="text-lg font-semibold text-white">${baslik}</h2>
    <p class="text-sm text-slate-400">${aciklama}</p></div>`;
}

function bosDurum(metin){
  return `<div class="rounded-xl bg-slate-900/40 border border-dashed border-slate-800 p-8 text-center text-slate-500 text-sm">${metin}</div>`;
}

function asamaRozeti(no){
  return `<span class="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">Asama ${no}</span>`;
}

// filtrelenmis siteler (arama)
const siteler = () => (VERI?.siteler||[]).filter(s => !ARAMA || (s.ad+s.url).toLowerCase().includes(ARAMA));

// ============ ONERI / DEGERLENDIRME MOTORU (kurallı, ucretsiz) ============
const ONCELIK_SIRA = { kritik: 0, yuksek: 1, orta: 2, dusuk: 3 };
const ONCELIK_RENK = { kritik: 'rose', yuksek: 'rose', orta: 'amber', dusuk: 'slate' };
const ETKI = { kritik: 4, yuksek: 3, orta: 2, dusuk: 1 };
// efor: 1 kolay, 2 orta, 3 zor
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
    const hizliKazanim = efor === 1 && (oncelik === 'kritik' || oncelik === 'yuksek');
    o.push({ site: s.ad, siteId: s.id, alan, oncelik, mesaj, efor, etki: ETKI[oncelik], hizliKazanim });
  };

  if (s.ssl && !s.ssl.gecerli) ekle('SSL', 'kritik', 'SSL yok/gecersiz — hemen kur.');
  else if (s.ssl && s.ssl.kalanGun <= 30) ekle('SSL', s.ssl.kalanGun <= 14 ? 'kritik' : 'yuksek', `SSL ${s.ssl.kalanGun} gun sonra doluyor — yenile.`);

  if (s.kirikLinkler?.length) ekle('Kirik link', 'yuksek', `${s.kirikLinkler.length} kirik link var — 404'leri duzelt veya yonlendir.`);
  if (!s.schema?.gecerli) ekle('Schema', 'orta', 'JSON-LD schema yok — LocalBusiness/Organization ekle (AI gorunurlugu icin de sart).');
  if (!s.sitemap?.varMi) ekle('Sitemap', 'yuksek', 'sitemap.xml yok — olustur ve Search Console\'a gonder.');
  else if (s.sitemap.erisilemez > 0) ekle('Sitemap', 'orta', `Sitemap'te ${s.sitemap.erisilemez} erisilemez URL var — temizle.`);

  const em = s.eksikMeta || {}; const meta = (em.title||0)+(em.description||0)+(em.h1||0);
  if (meta) ekle('Meta', 'orta', `${meta} sayfada eksik title/description/H1 — doldur.`);

  const op = s.onpage || {};
  if (op.altEksik > 10) ekle('Gorsel alt', 'dusuk', `${op.altEksik} gorselde alt text yok — ekle (erisilebilirlik + gorsel SEO).`);
  if (!op.tracking?.length) ekle('Olcum', 'orta', 'GA4/GTM yok — trafigi olcemezsin, kur.');
  if (op.keywordYogunluk === 'dusuk') ekle('Icerik', 'dusuk', 'Anahtar kelime yogunlugu dusuk — konu derinligini ve ilgili terimleri artir.');

  const h = s.hiz || {};
  if (h.mobilPuan != null && h.mobilPuan < 50) ekle('Hiz', 'yuksek', `Mobil hiz ${h.mobilPuan}/100 — kritik. Gorsel/JS optimize et.`);
  else if (h.mobilPuan != null && h.mobilPuan < 90) ekle('Hiz', 'dusuk', `Mobil hiz ${h.mobilPuan}/100 — iyilestir.`);
  if (h.cls > 0.25) ekle('CLS', 'orta', `CLS ${h.cls} yuksek — layout kaymasi var, gorsel/reklam alanlarina boyut ver.`);
  if (h.lcp > 4) ekle('LCP', 'orta', `LCP ${h.lcp}s yavas — en buyuk gorseli optimize et / preload.`);

  const ic = s.iclink || {};
  if (ic.ortLink != null && ic.ortLink < 5) ekle('Ic link', 'orta', `Ortalama ${ic.ortLink} ic link/sayfa — AZ. En az 5-8 hedefle, onemli sayfalara link ver.`);
  if (ic.orphan?.length) ekle('Orphan', 'orta', `${ic.orphan.length} oksuz sayfa var — menu veya ilgili yazilardan link ver.`);

  if (s.indeks?.dususVar) ekle('Indeks', 'yuksek', 'Indekslenen sayfa sayisi dustu — Search Console kapsam hatalarina bak.');
  else if (s.indeks?.indekssiz > 0) ekle('Indeks', 'dusuk', `${s.indeks.indekssiz} sayfa indekslenmemis — nedenini incele.`);

  // AI bot / GEO onerileri yalnizca o veri gercekten olculduyse (Asama 5). Veri yoksa uydurma uyari uretme.
  if (s.aiBotlar) {
    const b = s.aiBotlar;
    if (((b.gptbot||0)+(b.claudebot||0)+(b.perplexitybot||0)) < 20) ekle('AI bot', 'orta', 'AI botlari siteni az tariyor — llms.txt ekle, robots.txt\'de AI botlarina izin ver, icerigi netlestir.');
  }
  if (s.geo && (s.geo.chatgpt === false && s.geo.perplexity === false && s.geo.gemini === false)) {
    ekle('GEO', 'orta', 'Hicbir AI motorunda gorunmuyorsun — schema + net cevap formatli icerik + guclu marka sinyali gerek.');
  }

  (s.siralama || []).forEach(k => {
    if (k.pozisyon >= 4 && k.pozisyon <= 10 && (k.gosterim||0) >= 500)
      ekle('Kelime firsati', 'yuksek', `"${k.kelime}" #${k.pozisyon} + yuksek gosterim — az itmeyle ilk 3'e girer, ONCELIK VER.`);
    else if (k.pozisyon >= 11 && k.pozisyon <= 20)
      ekle('Kelime firsati', 'orta', `"${k.kelime}" #${k.pozisyon} (2. sayfa) — icerigi guclendir, 1. sayfaya tasi.`);
    if (k.onceki && k.pozisyon > k.onceki)
      ekle('Kelime dususu', 'orta', `"${k.kelime}" ${k.onceki}→${k.pozisyon} dustu — sayfayi ve rakipleri incele.`);
  });

  (s.kanibalizasyon || []).forEach(k =>
    ekle('Kanibalizasyon', 'orta', `"${k.kelime}" icin ${k.sayfalar.length} sayfa yarisiyor (${k.sayfalar.join(', ')}) — birini ana yap, digerlerini birlestir/yonlendir.`));

  (s.icerikBoslugu || []).forEach(g =>
    ekle('Icerik boslugu', g.hacim >= 500 ? 'yuksek' : 'orta', `"${g.kelime}" (~${g.hacim} arama) — rakip ${g.rakip} #${g.rakipPoz}'de, sende yok. Bu konuda icerik yaz.`));

  return o;
}

function tumOneriler(){
  return (VERI?.siteler || []).flatMap(oneriUret).sort((a,b) => ONCELIK_SIRA[a.oncelik]-ONCELIK_SIRA[b.oncelik]);
}

// ic link degerlendirmesi
function icLinkYorum(n){
  if (n == null) return { metin: '-', renk: 'slate' };
  if (n < 5)  return { metin: 'AZ', renk: 'amber' };
  if (n <= 15) return { metin: 'ideal', renk: 'emerald' };
  return { metin: 'COK', renk: 'amber' };
}

// ============ MANUEL RAKIP (localStorage) ============
const RAKIP_KEY = 'seotakip_rakipler_v1';
function rakipEkGetir(){ try { return JSON.parse(localStorage.getItem(RAKIP_KEY)) || {}; } catch(e){ return {}; } }
function rakipEkKaydet(o){ localStorage.setItem(RAKIP_KEY, JSON.stringify(o)); }
function rakipEkle(){
  const siteId = el('rk-site').value;
  const kelime = el('rk-kelime').value.trim();
  const ad = el('rk-ad').value.trim().replace(/^https?:\/\//,'').replace(/\/.*$/,'');
  if (!kelime || !ad) { alert('Anahtar kelime ve rakip alan adi gerekli.'); return; }
  const store = rakipEkGetir();
  (store[siteId] = store[siteId] || []).push({ ad, kelime, biz: null, rakipPoz: null, manuel: true });
  rakipEkKaydet(store);
  git('rakip');
}
function rakipSil(siteId, idx){ const s = rakipEkGetir(); if (s[siteId]) { s[siteId].splice(idx,1); rakipEkKaydet(s); git('rakip'); } }
window.rakipEkle = rakipEkle; window.rakipSil = rakipSil;

// ============ ARAC URETICILER (llms.txt, robots, schema) ============
let ARAC_SITE = null;
function aracSite(){ return (VERI?.siteler||[]).find(s => s.id === ARAC_SITE) || (VERI?.siteler||[])[0]; }
function aracDegis(){ ARAC_SITE = el('arac-site').value; git('araclar'); }
window.aracDegis = aracDegis;

function uretLlms(s){
  return `# ${s.ad}\n`+
    `> ${s.ad} — ${kisaUrl(s.url)} resmi sitesi.\n\n`+
    `## Hakkinda\n- Site: ${s.url}\n- Diller: ${(s.diller||['tr']).join(', ')}\n\n`+
    `## Onemli sayfalar\n- [Ana sayfa](${s.url})\n- [Hizmetler](${s.url}/hizmetler)\n- [Iletisim](${s.url}/iletisim)\n\n`+
    `## Not\nBu icerik AI asistanlarinin siteyi dogru ozetlemesi icindir. Detaylari kendine gore duzenle.\n`;
}
function uretRobots(s){
  return `# ${s.ad} — AI bot erisimi (robots.txt'e ekle)\n`+
    `User-agent: GPTBot\nAllow: /\n\n`+
    `User-agent: OAI-SearchBot\nAllow: /\n\n`+
    `User-agent: ChatGPT-User\nAllow: /\n\n`+
    `User-agent: ClaudeBot\nAllow: /\n\n`+
    `User-agent: PerplexityBot\nAllow: /\n\n`+
    `User-agent: Google-Extended\nAllow: /\n\n`+
    `Sitemap: ${s.url}/sitemap.xml\n`;
}
function uretSchema(s){
  const obj = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": s.ad,
    "url": s.url,
    "image": s.url + "/logo.png",
    "telephone": "+90 ___ ___ __ __",
    "address": { "@type": "PostalAddress", "addressLocality": "___", "addressCountry": "CY" },
    "sameAs": ["https://facebook.com/___", "https://instagram.com/___"]
  };
  return JSON.stringify(obj, null, 2);
}
function kopyala(id, btn){
  const t = el(id); const metin = t.value != null ? t.value : t.textContent;
  const ok = () => { if (btn) { const o = btn.textContent; btn.textContent = 'kopyalandi ✓'; setTimeout(()=>btn.textContent=o, 1200); } };
  if (navigator.clipboard) navigator.clipboard.writeText(metin).then(ok, ok); else ok();
}
window.kopyala = kopyala;

// ============ HAFTALIK AKILLI OZET (kurallı) ============
function haftalikOzetUret(){
  const t = tumOneriler();
  const k = t.filter(o=>o.oncelik==='kritik').length;
  const y = t.filter(o=>o.oncelik==='yuksek').length;
  const hizli = t.filter(o=>o.hizliKazanim).length;
  const deg = VERI.degisiklikler || [];
  const artis = deg.filter(d=>d.tip==='artis');
  const dusus = deg.filter(d=>d.tip==='dusus' || d.tip==='yeni-kirik');
  let s = `Bu hafta ${VERI.ozet?.toplamSite} site takip edildi; ortalama SEO puani ${VERI.ozet?.ortalamaSeoPuan}/100. `;
  s += k ? `${k} kritik ve ${y} yuksek oncelikli sorun var — once bunlari kapat. ` : `Kritik sorun yok; ${y} yuksek oncelikli madde mevcut. `;
  if (hizli) s += `${hizli} adet "hizli kazanim" (yuksek etki, kolay) var, bunlarla basla. `;
  if (artis.length) s += `Olumlu: ${artis.map(a=>a.mesaj).join('; ')}. `;
  if (dusus.length) s += `Dikkat: ${dusus.map(a=>a.mesaj).join('; ')}. `;
  const ilk3 = t.slice(0,3).map(a=>`(${a.site}) ${a.mesaj}`).join('  |  ');
  if (ilk3) s += `Onerilen ilk 3 aksiyon: ${ilk3}`;
  return s;
}

// ============ BOLUMLER ============
const VIEWS = {

  genel(){
    const o = VERI.ozet||{};
    const kartlar = siteler().map(siteKart).join('') || bosDurum('Aramaya uyan site yok.');
    const ilk3 = tumOneriler().slice(0,3);
    const aksiyonSerit = ilk3.length ? `
      <div class="rounded-xl bg-gradient-to-r from-indigo-950/60 to-slate-900/60 border border-indigo-900/40 p-4 mb-6">
        <div class="flex items-center justify-between mb-2">
          <p class="text-sm font-semibold text-white flex items-center gap-2"><span class="text-amber-400">★</span> Oncelikli aksiyonlar</p>
          <button onclick="git('oneri')" class="text-xs text-indigo-300 hover:underline">tumunu gor →</button>
        </div>
        <ul class="space-y-1.5">${ilk3.map(a=>`<li class="flex items-start gap-2 text-sm">
          ${chip(a.oncelik, ONCELIK_RENK[a.oncelik])}
          <span class="text-slate-300 flex-1"><span class="text-slate-500">[${a.site}]</span> ${a.mesaj}</span></li>`).join('')}</ul>
      </div>` : '';
    return aksiyonSerit + `
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        ${karo('Takip edilen site', o.toplamSite, 'aktif')}
        ${karo('Ortalama SEO puani', o.ortalamaSeoPuan, '100 uzerinden', puanRenk(o.ortalamaSeoPuan))}
        ${karo('Toplam kirik link', o.toplamKirikLink, o.toplamKirikLink?'duzeltilmeli':'temiz', o.toplamKirikLink?'text-rose-400':'text-emerald-400')}
        ${karo('Acil uyari', o.acilUyari, 'dikkat', o.acilUyari?'text-amber-400':'text-emerald-400')}
      </section>
      ${uyariBloku(VERI.uyarilar)}
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mt-6">${kartlar}</section>`;
  },

  siteler(){
    const satir = (s) => `<tr class="border-t border-slate-800 hover:bg-slate-800/30">
      <td class="py-3 px-3"><div class="flex items-center gap-2">
        <span class="h-2 w-2 rounded-full ${s.uptime?.durum==='up'?'bg-emerald-400':'bg-rose-400'}"></span>
        <span class="font-medium text-white">${s.ad}</span></div>
        <a href="${s.url}" target="_blank" class="text-xs text-indigo-400 hover:underline">${kisaUrl(s.url)}</a></td>
      <td class="py-3 px-3 text-center ${puanRenk(s.seo?.puan)} font-semibold">${s.seo?.puan??'-'}</td>
      <td class="py-3 px-3 text-center ${trendRenk(s.seo?.trend)}">${s.seo?.trend??'0'}</td>
      <td class="py-3 px-3 text-center">${s.sayfalar?.taranan??'-'}</td>
      <td class="py-3 px-3 text-center">${(s.kirikLinkler?.length||0)?`<span class="text-rose-400">${s.kirikLinkler.length}</span>`:'<span class="text-emerald-400">0</span>'}</td>
      <td class="py-3 px-3 text-center">${sslChip(s.ssl)}</td>
    </tr>`;
    return bolumBaslik('Siteler','Takip edilen tum siteler. Yeni site eklemek icin sites.config.json duzenlenir.') + `
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto">
        <table class="w-full text-sm min-w-[560px]"><thead class="text-xs text-slate-400 text-left">
          <tr><th class="py-2.5 px-3">Site</th><th class="py-2.5 px-3 text-center">SEO</th>
          <th class="py-2.5 px-3 text-center">Trend</th><th class="py-2.5 px-3 text-center">Sayfa</th>
          <th class="py-2.5 px-3 text-center">Kirik</th><th class="py-2.5 px-3 text-center">SSL</th></tr>
        </thead><tbody>${siteler().map(satir).join('')}</tbody></table></div>`;
  },

  kirik(){
    const bloklar = siteler().map(s => {
      const list = s.kirikLinkler||[];
      if(!list.length) return '';
      const satir = (k) => `<tr class="border-t border-slate-800">
        <td class="py-2 px-3 text-slate-300">${k.kaynak}</td>
        <td class="py-2 px-3 text-slate-400">${k.hedef}</td>
        <td class="py-2 px-3 text-center">${chip(k.kod,'rose')}</td></tr>`;
      return `<div class="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto mb-4">
        <div class="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
          <span class="font-medium text-white">${s.ad}</span>${chip(list.length+' kirik link','rose')}</div>
        <table class="w-full text-sm min-w-[520px]"><thead class="text-xs text-slate-400 text-left">
          <tr><th class="py-2 px-3">Kaynak sayfa</th><th class="py-2 px-3">Hedef</th><th class="py-2 px-3 text-center">Kod</th></tr>
        </thead><tbody>${list.map(satir).join('')}</tbody></table></div>`;
    }).join('');
    return bolumBaslik('Kirik Linkler','Tum sitelerde 404/500 veren baglantilar.') +
      (bloklar || bosDurum('🎉 Hic kirik link yok. Tum baglantilar saglam.'));
  },

  denetim(){
    const satir = (s) => {
      const em = s.eksikMeta||{}; const eksik = (em.title||0)+(em.description||0)+(em.h1||0);
      const op = s.onpage||{};
      return `<tr class="border-t border-slate-800 hover:bg-slate-800/30">
        <td class="py-3 px-3 font-medium text-white">${s.ad}</td>
        <td class="py-3 px-3 text-center">${eksik?chip(eksik,'amber'):chip('0','emerald')}</td>
        <td class="py-3 px-3 text-center">${durumChip(s.schema?.gecerli,'OK','yok')}</td>
        <td class="py-3 px-3 text-center">${durumChip(s.sitemap?.varMi && s.sitemap.erisilemez===0,'OK','sorun')}</td>
        <td class="py-3 px-3 text-center">${durumChip((s.canonical?.eksik||0)+(s.canonical?.hatali||0)===0,'OK','sorun')}</td>
        <td class="py-3 px-3 text-center">${durumChip(!s.hreflang?.sorun,'OK','sorun')}</td>
        <td class="py-3 px-3 text-center">${(op.altEksik||0)?chip(op.altEksik,'amber'):chip('0','emerald')}</td>
        <td class="py-3 px-3 text-center">${(op.ogEksik||0)?chip(op.ogEksik,'amber'):chip('0','emerald')}</td>
        <td class="py-3 px-3 text-center">${op.tracking?.length?chip(op.tracking.join('+'),'emerald'):chip('yok','rose')}</td>
      </tr>`;
    };
    return bolumBaslik('SEO Denetim','Meta, schema, sitemap, canonical, hreflang + on-page (alt text, OG, tracking kodu).') + `
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto">
        <table class="w-full text-sm min-w-[760px]"><thead class="text-xs text-slate-400 text-left">
          <tr><th class="py-2.5 px-3">Site</th><th class="py-2.5 px-3 text-center">Eksik meta</th>
          <th class="py-2.5 px-3 text-center">Schema</th><th class="py-2.5 px-3 text-center">Sitemap</th>
          <th class="py-2.5 px-3 text-center">Canonical</th><th class="py-2.5 px-3 text-center">hreflang</th>
          <th class="py-2.5 px-3 text-center">Eksik alt</th><th class="py-2.5 px-3 text-center">OG eksik</th>
          <th class="py-2.5 px-3 text-center">Tracking</th></tr>
        </thead><tbody>${siteler().map(satir).join('')}</tbody></table></div>`;
  },

  kelime(){
    const bloklar = siteler().map(s => {
      const list = s.siralama||[];
      if(!list.length) return '';
      const satir = (k) => {
        const yon = k.pozisyon<k.onceki?'▲':k.pozisyon>k.onceki?'▼':'–';
        const renk = k.pozisyon<k.onceki?'text-emerald-400':k.pozisyon>k.onceki?'text-rose-400':'text-slate-500';
        return `<tr class="border-t border-slate-800">
          <td class="py-2 px-3 text-slate-200">${k.kelime}</td>
          <td class="py-2 px-3 text-center font-semibold">#${k.pozisyon}</td>
          <td class="py-2 px-3 text-center ${renk}">${yon} ${Math.abs((k.onceki||k.pozisyon)-k.pozisyon)||''}</td>
          <td class="py-2 px-3 text-center text-slate-400">${k.gosterim??'-'}</td></tr>`;
      };
      return `<div class="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto mb-4">
        <div class="px-3 py-2 border-b border-slate-800 font-medium text-white">${s.ad}</div>
        <table class="w-full text-sm min-w-[480px]"><thead class="text-xs text-slate-400 text-left">
          <tr><th class="py-2 px-3">Anahtar kelime</th><th class="py-2 px-3 text-center">Pozisyon</th>
          <th class="py-2 px-3 text-center">Degisim</th><th class="py-2 px-3 text-center">Gosterim</th></tr>
        </thead><tbody>${list.map(satir).join('')}</tbody></table></div>`;
    }).join('');
    return bolumBaslik('Anahtar Kelime & Siralama','Google Search Console verisiyle beslenecek (Asama 3, ucretsiz).') +
      `<div class="mb-4">${asamaRozeti(3)} <span class="text-xs text-slate-500 ml-1">gercek veri Search Console baglaninca gelir</span></div>` +
      (bloklar || bosDurum('Henuz siralama verisi yok.'));
  },

  icerik(){
    return bolumBaslik('AI Icerik / Auto SEO Blog','Anahtar kelimeye gore SEO uyumlu blog yazisi uretir.') + `
      <div class="mb-4">${asamaRozeti(4)}</div>
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-5 space-y-3">
          <p class="text-sm font-medium text-white">Yeni icerik uret</p>
          <select class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300">
            ${(VERI.siteler||[]).map(s=>`<option>${s.ad}</option>`).join('')}
          </select>
          <input placeholder="hedef anahtar kelime (or. girne veteriner)" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm" />
          <select class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300">
            <option>Blog yazisi (800-1200 kelime)</option><option>Hizmet sayfasi metni</option><option>Meta title + description</option>
          </select>
          <button disabled class="w-full py-2 rounded-lg bg-indigo-600/40 text-indigo-200 text-sm cursor-not-allowed">Uret (Asama 4'te aktif)</button>
          <p class="text-[11px] text-slate-500">Ucretsiz secenek: Gemini / Groq free tier. Claude ile de baglanabilir.</p>
        </div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-5">
          <p class="text-sm font-medium text-white mb-2">Uretilen icerikler</p>
          ${bosDurum('Henuz icerik uretilmedi.')}
        </div>
      </div>`;
  },

  geo(){
    const kaynaklar = ['chatgpt','perplexity','gemini'];
    const adlar = {chatgpt:'ChatGPT', perplexity:'Perplexity', gemini:'Gemini'};
    const satir = (s) => `<tr class="border-t border-slate-800 hover:bg-slate-800/30">
      <td class="py-3 px-3 font-medium text-white">${s.ad}</td>
      ${kaynaklar.map(k=>`<td class="py-3 px-3 text-center">${(s.geo?.[k])?chip('goruluyor','violet'):chip('yok','slate')}</td>`).join('')}
    </tr>`;
    return bolumBaslik('GEO / AI Gorunurluk','Markanin AI motorlarinda cikip cikmadigi (Asama 5).') + `
      <div class="mb-4">${asamaRozeti(5)}</div>
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto">
        <table class="w-full text-sm min-w-[480px]"><thead class="text-xs text-slate-400 text-left">
          <tr><th class="py-2.5 px-3">Site</th>${kaynaklar.map(k=>`<th class="py-2.5 px-3 text-center">${adlar[k]}</th>`).join('')}</tr>
        </thead><tbody>${siteler().map(satir).join('')}</tbody></table></div>`;
  },

  uyarilar(){
    return bolumBaslik('Uyarilar','SSL bitisi, site cokusu, kirik link ve denetim sorunlari.') + uyariBloku(VERI.uyarilar, true);
  },

  oneri(){
    let list = tumOneriler();
    if (ARAMA) list = list.filter(o => (o.site).toLowerCase().includes(ARAMA));
    const say = (p) => list.filter(o => o.oncelik===p).length;
    const eforChip = (e) => chip(EFOR_AD[e], e===1?'emerald':e===2?'amber':'rose');
    const satir = (o) => `<li class="flex items-start gap-3 py-2.5 px-3 border-t border-slate-800">
      <span class="shrink-0 mt-0.5">${chip(o.oncelik, ONCELIK_RENK[o.oncelik])}</span>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-slate-200">${o.hizliKazanim?'<span class="text-amber-400">⚡ </span>':''}${o.mesaj}</p>
        <p class="text-[11px] text-slate-500">[${o.site}] · ${o.alan}</p>
      </div>
      <span class="shrink-0 mt-0.5 flex items-center gap-1"><span class="text-[10px] text-slate-600">efor</span>${eforChip(o.efor)}</span></li>`;

    const hizli = list.filter(o => o.hizliKazanim);
    const hizliBlok = hizli.length ? `
      <div class="rounded-xl bg-gradient-to-r from-emerald-950/50 to-slate-900/60 border border-emerald-900/40 p-4 mb-5">
        <p class="text-sm font-semibold text-white mb-2 flex items-center gap-2"><span class="text-amber-400">⚡</span> Hizli Kazanimlar <span class="text-[11px] text-slate-400 font-normal">(yuksek etki + kolay)</span></p>
        <ul class="space-y-1.5">${hizli.map(o=>`<li class="text-sm text-slate-300"><span class="text-slate-500">[${o.site}]</span> ${o.mesaj}</li>`).join('')}</ul>
      </div>` : '';

    return bolumBaslik('Oneriler / Aksiyon', 'Her sorun onceliklendirilmis + etki/efor skoruyla. ⚡ isaretliler once yapilmali (yuksek etki, dusuk efor).') + `
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        ${karo('Kritik', say('kritik'), 'hemen', say('kritik')?'text-rose-400':'text-emerald-400')}
        ${karo('Yuksek', say('yuksek'), 'bu hafta', say('yuksek')?'text-rose-300':'text-emerald-400')}
        ${karo('Orta', say('orta'), 'planla', 'text-amber-400')}
        ${karo('Dusuk', say('dusuk'), 'firsat buldukca', 'text-slate-300')}
      </section>
      ${hizliBlok}
      ${list.length ? `<div class="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden"><ul>${list.map(satir).join('')}</ul></div>`
        : bosDurum('🎉 Aksiyon gerektiren bir sey yok. Her sey yolunda.')}`;
  },

  hiz(){
    const vitalChip=(deger,iyi,orta)=>chip(deger, deger<=iyi?'emerald':deger<=orta?'amber':'rose');
    const satir=(s)=>{const h=s.hiz||{};return `<tr class="border-t border-slate-800 hover:bg-slate-800/30">
      <td class="py-3 px-3 font-medium text-white">${s.ad}</td>
      <td class="py-3 px-3 text-center ${puanRenk(h.mobilPuan)}">${h.mobilPuan??'-'}</td>
      <td class="py-3 px-3 text-center ${puanRenk(h.masaustuPuan)}">${h.masaustuPuan??'-'}</td>
      <td class="py-3 px-3 text-center">${vitalChip(h.lcp,2.5,4)+' s'}</td>
      <td class="py-3 px-3 text-center">${vitalChip(h.inp,200,500)+' ms'}</td>
      <td class="py-3 px-3 text-center">${vitalChip(h.cls,0.1,0.25)}</td></tr>`;};
    return bolumBaslik('Hiz / Core Web Vitals','LCP, INP, CLS + mobil/masaustu hiz. Google PageSpeed API ile bedava.') +
      `<div class="mb-4">${asamaRozeti(2)} <span class="text-xs text-slate-500 ml-1">PageSpeed API baglaninca gercek gelir</span></div>
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto">
        <table class="w-full text-sm min-w-[560px]"><thead class="text-xs text-slate-400 text-left">
          <tr><th class="py-2.5 px-3">Site</th><th class="py-2.5 px-3 text-center">Mobil</th>
          <th class="py-2.5 px-3 text-center">Masaustu</th><th class="py-2.5 px-3 text-center">LCP</th>
          <th class="py-2.5 px-3 text-center">INP</th><th class="py-2.5 px-3 text-center">CLS</th></tr>
        </thead><tbody>${siteler().map(satir).join('')}</tbody></table></div>`;
  },

  indeks(){
    const satir=(s)=>{const i=s.indeks||{};return `<tr class="border-t border-slate-800 hover:bg-slate-800/30">
      <td class="py-3 px-3 font-medium text-white">${s.ad}</td>
      <td class="py-3 px-3 text-center text-emerald-400">${i.indeksli??'-'}</td>
      <td class="py-3 px-3 text-center ${(i.indekssiz||0)?'text-amber-400':'text-slate-400'}">${i.indekssiz??'-'}</td>
      <td class="py-3 px-3 text-center">${i.dususVar?chip('dusus var','rose'):chip('stabil','emerald')}</td></tr>`;};
    return bolumBaslik('Indeks Monitoru','Sayfalar Google\'da indeksli mi, dusen sayfa var mi. Search Console ile bedava.') +
      `<div class="mb-4">${asamaRozeti(3)}</div>
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto">
        <table class="w-full text-sm min-w-[480px]"><thead class="text-xs text-slate-400 text-left">
          <tr><th class="py-2.5 px-3">Site</th><th class="py-2.5 px-3 text-center">Indeksli</th>
          <th class="py-2.5 px-3 text-center">Indekssiz</th><th class="py-2.5 px-3 text-center">Durum</th></tr>
        </thead><tbody>${siteler().map(satir).join('')}</tbody></table></div>`;
  },

  botlar(){
    const satir=(s)=>{const b=s.aiBotlar||{};return `<tr class="border-t border-slate-800 hover:bg-slate-800/30">
      <td class="py-3 px-3 font-medium text-white">${s.ad}</td>
      <td class="py-3 px-3 text-center">${chip('GPTBot '+(b.gptbot??0), b.gptbot?'violet':'slate')}</td>
      <td class="py-3 px-3 text-center">${chip('ClaudeBot '+(b.claudebot??0), b.claudebot?'violet':'slate')}</td>
      <td class="py-3 px-3 text-center">${chip('PerplexityBot '+(b.perplexitybot??0), b.perplexitybot?'violet':'slate')}</td>
      <td class="py-3 px-3 text-center text-slate-400">${b.sonZiyaret??'-'}</td></tr>`;};
    return bolumBaslik('AI Bot Takibi','ChatGPT/Claude/Perplexity botlari siteni taradı mi (son 30 gun, sunucu logundan).') +
      `<div class="mb-4">${asamaRozeti(5)} <span class="text-xs text-slate-500 ml-1">GEO icin kritik: AI botu gelmezse AI cevaplarinda cikamazsin</span></div>
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto">
        <table class="w-full text-sm min-w-[640px]"><thead class="text-xs text-slate-400 text-left">
          <tr><th class="py-2.5 px-3">Site</th><th class="py-2.5 px-3 text-center">OpenAI</th>
          <th class="py-2.5 px-3 text-center">Anthropic</th><th class="py-2.5 px-3 text-center">Perplexity</th>
          <th class="py-2.5 px-3 text-center">Son ziyaret</th></tr>
        </thead><tbody>${siteler().map(satir).join('')}</tbody></table></div>`;
  },

  degisim(){
    const list=VERI.degisiklikler||[];
    const renk={dusus:'rose','yeni-kirik':'rose',artis:'emerald','yeni-sayfa':'violet'};
    const ikon={dusus:'▼','yeni-kirik':'⚠',artis:'▲','yeni-sayfa':'＋'};
    const satir=(d)=>`<li class="flex items-start gap-3 py-2.5 px-1 border-t border-slate-800">
      <span class="text-${renk[d.tip]||'slate'}-400 text-xs mt-0.5">${ikon[d.tip]||'•'}</span>
      <div class="flex-1"><p class="text-sm text-slate-200">${d.mesaj}</p>
        <p class="text-[11px] text-slate-500">[${d.site}] · ${d.tarih}</p></div></li>`;
    return bolumBaslik('Degisiklik Izleyici','Iki tarama arasi farklar: dusen puan, yeni kirik link, siralama degisimi, yeni sayfa.') +
      (list.length?`<div class="rounded-xl bg-slate-900/60 border border-slate-800 p-3"><ul>${list.map(satir).join('')}</ul></div>`:bosDurum('Son taramada degisiklik yok.'));
  },

  rakip(){
    const store = rakipEkGetir();
    const form = `<div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 mb-5">
      <p class="text-sm font-medium text-white mb-3">Rakip ekle <span class="text-[11px] text-slate-500 font-normal">(tarayicinda saklanir)</span></p>
      <div class="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <select id="rk-site" class="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300">
          ${(VERI.siteler||[]).filter(s=>s.aktif!==false).map(s=>`<option value="${s.id}">${s.ad}</option>`).join('')}</select>
        <input id="rk-kelime" placeholder="anahtar kelime" class="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm" />
        <input id="rk-ad" placeholder="rakip alan adi (or. rakip.com)" class="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm" />
        <button onclick="rakipEkle()" class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm">+ Ekle</button>
      </div>
      <p class="text-[11px] text-slate-500 mt-2">Pozisyonlar Asama 3'te SERP kontrolu ile otomatik dolar. Su an manuel takip listesi.</p>
    </div>`;

    const bloklar = siteler().map(s => {
      const list = [ ...(s.rakip||[]), ...((store[s.id]||[])) ];
      if (!list.length) return '';
      const satir = (r, i, manuelBaslangic) => {
        const olculdu = r.biz != null && r.rakipPoz != null;
        const onde = olculdu && r.biz < r.rakipPoz;
        const durum = !olculdu ? chip('olcum bekliyor','slate') : onde ? chip('ondesin','emerald') : chip('geridesin','rose');
        const silBtn = r.manuel ? `<button onclick="rakipSil('${s.id}',${i-manuelBaslangic})" class="text-rose-400 hover:text-rose-300 text-xs">sil</button>` : '';
        return `<tr class="border-t border-slate-800">
          <td class="py-2 px-3 text-slate-200">${r.kelime}${r.manuel?' <span class="text-[10px] text-indigo-400">(manuel)</span>':''}</td>
          <td class="py-2 px-3 text-slate-400">${r.ad}</td>
          <td class="py-2 px-3 text-center font-semibold">${r.biz!=null?'#'+r.biz:'—'}</td>
          <td class="py-2 px-3 text-center text-slate-400">${r.rakipPoz!=null?'#'+r.rakipPoz:'—'}</td>
          <td class="py-2 px-3 text-center">${durum}</td>
          <td class="py-2 px-3 text-center">${silBtn}</td></tr>`;
      };
      const manuelBaslangic = (s.rakip||[]).length;
      return `<div class="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto mb-4">
        <div class="px-3 py-2 border-b border-slate-800 font-medium text-white">${s.ad}</div>
        <table class="w-full text-sm min-w-[600px]"><thead class="text-xs text-slate-400 text-left">
          <tr><th class="py-2 px-3">Kelime</th><th class="py-2 px-3">Rakip</th>
          <th class="py-2 px-3 text-center">Sen</th><th class="py-2 px-3 text-center">Rakip</th>
          <th class="py-2 px-3 text-center">Durum</th><th class="py-2 px-3"></th></tr>
        </thead><tbody>${list.map((r,i)=>satir(r,i,manuelBaslangic)).join('')}</tbody></table></div>`;
    }).join('');

    return bolumBaslik('Rakip Analizi','Rakipleri manuel ekle; pozisyonlar SERP kontroluyle dolar. Senin bosluklarin burada gorunur.') +
      form + (bloklar || bosDurum('Henuz rakip yok. Yukaridan ekle.'));
  },

  iclink(){
    const satir=(s)=>{const i=s.iclink||{};const orphan=i.orphan||[];const y=icLinkYorum(i.ortLink);
      return `<tr class="border-t border-slate-800 hover:bg-slate-800/30 align-top">
      <td class="py-3 px-3 font-medium text-white">${s.ad}</td>
      <td class="py-3 px-3 text-center text-slate-300">${i.ortLink??'-'}</td>
      <td class="py-3 px-3 text-center">${chip(y.metin, y.renk)}</td>
      <td class="py-3 px-3 text-center">${orphan.length?chip(orphan.length,'amber'):chip('0','emerald')}</td>
      <td class="py-3 px-3 text-slate-400 text-xs">${orphan.length?orphan.join('<br>'):'—'}</td></tr>`;};
    return bolumBaslik('Ic Linkleme & Orphan Sayfalar','Degerlendirme: <5 az, 5-15 ideal, >15 cok. Oksuz sayfalar hic ic link almiyor.') +
      `<div class="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto">
        <table class="w-full text-sm min-w-[620px]"><thead class="text-xs text-slate-400 text-left">
          <tr><th class="py-2.5 px-3">Site</th><th class="py-2.5 px-3 text-center">Ort. ic link/sayfa</th>
          <th class="py-2.5 px-3 text-center">Degerlendirme</th>
          <th class="py-2.5 px-3 text-center">Orphan</th><th class="py-2.5 px-3">Orphan sayfalar</th></tr>
        </thead><tbody>${siteler().map(satir).join('')}</tbody></table></div>`;
  },

  gap(){
    const bloklar = siteler().map(s => {
      const list = s.icerikBoslugu || [];
      if (!list.length) return '';
      const satir = (g) => `<tr class="border-t border-slate-800">
        <td class="py-2 px-3 text-slate-200">${g.kelime}</td>
        <td class="py-2 px-3 text-center text-slate-300">~${g.hacim}</td>
        <td class="py-2 px-3 text-slate-400">${g.rakip} <span class="text-slate-600">#${g.rakipPoz}</span></td>
        <td class="py-2 px-3 text-center">${g.hacim>=500?chip('yuksek firsat','emerald'):chip('firsat','amber')}</td></tr>`;
      return `<div class="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto mb-4">
        <div class="px-3 py-2 border-b border-slate-800 font-medium text-white">${s.ad}</div>
        <table class="w-full text-sm min-w-[520px]"><thead class="text-xs text-slate-400 text-left">
          <tr><th class="py-2 px-3">Kelime (sende yok)</th><th class="py-2 px-3 text-center">Arama hacmi</th>
          <th class="py-2 px-3">Rakip siralaniyor</th><th class="py-2 px-3 text-center">Durum</th></tr>
        </thead><tbody>${list.map(satir).join('')}</tbody></table></div>`;
    }).join('');
    return bolumBaslik('Icerik Boslugu','Rakiplerin siralandigi ama sende olmayan kelimeler = yazacagin bir sonraki icerikler.') +
      `<div class="mb-4">${asamaRozeti(3)} <span class="text-xs text-slate-500 ml-1">gercek veri Search Console + rakip taramasiyla gelir</span></div>` +
      (bloklar || bosDurum('Icerik boslugu tespit edilmedi.'));
  },

  araclar(){
    const s = aracSite();
    if (!s) return bosDurum('Once site tanimla.');
    const alan = (baslik, aciklama, id, icerik) => `
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 mb-4">
        <div class="flex items-center justify-between mb-1">
          <p class="text-sm font-medium text-white">${baslik}</p>
          <button onclick="kopyala('${id}', this)" class="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700">Kopyala</button>
        </div>
        <p class="text-[11px] text-slate-500 mb-2">${aciklama}</p>
        <textarea id="${id}" readonly rows="7" class="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300 resize-y">${iceric(icerik)}</textarea>
      </div>`;
    function iceric(x){ return String(x).replace(/</g,'&lt;'); }
    return bolumBaslik('Araclar','Hazir dosya ureticiler — kopyala, sitene yapistir. Tamamen ucretsiz.') + `
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 mb-5">
        <label class="text-xs text-slate-400">Site sec:</label>
        <select id="arac-site" onchange="aracDegis()" class="ml-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-300">
          ${(VERI.siteler||[]).filter(x=>x.aktif!==false).map(x=>`<option value="${x.id}" ${x.id===s.id?'selected':''}>${x.ad}</option>`).join('')}
        </select>
      </div>
      ${alan('llms.txt', 'AI asistanlarinin siteni dogru ozetlemesi icin. Site kokune /llms.txt olarak koy.', 'out-llms', uretLlms(s))}
      ${alan('robots.txt — AI bot erisimi', 'AI botlarinin siteni taramasina izin ver (GEO icin sart). robots.txt\'e ekle.', 'out-robots', uretRobots(s))}
      ${alan('Schema (JSON-LD)', 'LocalBusiness yapisal veri. ___ alanlarini doldur, sayfa head bolumune JSON-LD script etiketi icinde koy.', 'out-schema', uretSchema(s))}`;
  },

  raporlar(){
    const list=VERI.raporlar||[];
    const kart=(r)=>`<div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 flex items-center justify-between">
      <div><p class="text-sm font-medium text-white">${r.ad}</p><p class="text-[11px] text-slate-500">${r.tur} · ${r.tarih}</p></div>
      <button disabled class="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed">PDF (Asama 5)</button></div>`;
    const ozet = `<div class="rounded-xl bg-gradient-to-r from-indigo-950/50 to-slate-900/60 border border-indigo-900/40 p-4 mb-5">
      <p class="text-sm font-semibold text-white mb-2 flex items-center gap-2"><span class="text-indigo-300">✦</span> Haftalik Akilli Ozet</p>
      <p class="text-sm text-slate-300 leading-relaxed">${haftalikOzetUret()}</p>
      <p class="text-[11px] text-slate-500 mt-2">Kurallı motorla uretildi (ucretsiz). Asama 4'te AI ile daha akici hale getirilebilir.</p></div>`;
    return bolumBaslik('Raporlar','Otomatik haftalik ozet + indirilebilir raporlar.') + ozet +
      `<div class="mb-4">${asamaRozeti(5)} <span class="text-xs text-slate-500 ml-1">PDF/e-posta cikti Asama 5'te</span></div>
      <div class="grid gap-3 sm:grid-cols-2">${list.map(kart).join('')||bosDurum('Henuz rapor uretilmedi.')}</div>`;
  },

  ayarlar(){
    const site = (s)=>`<tr class="border-t border-slate-800">
      <td class="py-2 px-3 text-white">${s.ad}</td>
      <td class="py-2 px-3 text-indigo-400">${kisaUrl(s.url)||'<span class=\"text-slate-600\">— (yakinda)</span>'}</td>
      <td class="py-2 px-3 text-center">${s.aktif?chip('aktif','emerald'):chip('pasif','slate')}</td></tr>`;
    return bolumBaslik('Ayarlar','Site tanimlari ve otomasyon. Kaynak: sites.config.json') + `
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto mb-6">
        <div class="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
          <span class="font-medium text-white">Tanimli siteler</span>
          <span class="text-[11px] text-slate-500">duzenlemek icin sites.config.json</span></div>
        <table class="w-full text-sm min-w-[420px]"><thead class="text-xs text-slate-400 text-left">
          <tr><th class="py-2 px-3">Ad</th><th class="py-2 px-3">URL</th><th class="py-2 px-3 text-center">Durum</th></tr>
        </thead><tbody>${(VERI.siteler||[]).map(site).join('')}
          <tr class="border-t border-slate-800"><td class="py-2 px-3 text-slate-500">5. Proje</td>
          <td class="py-2 px-3 text-slate-600">— (yakinda)</td><td class="py-2 px-3 text-center">${chip('pasif','slate')}</td></tr>
        </tbody></table></div>
      <div class="grid gap-4 sm:grid-cols-3">
        ${karo('Otomasyon','GitHub Actions','her gece tarar — ucretsiz')}
        ${karo('Yayin','GitHub Pages','sunucu yok — ucretsiz')}
        ${karo('Uyari kanali','Telegram','kurulacak (Asama 5)')}
      </div>`;
  },
};

// ---- ortak: uyari bloku ----
function uyariBloku(list, tamSayfa){
  if(!list || !list.length) return tamSayfa ? bosDurum('Aktif uyari yok. Her sey yolunda.') : '';
  const satir = (u) => {
    const kritik = u.seviye==='kritik';
    return `<li class="flex items-start gap-2 py-1.5 px-1">
      <span class="${kritik?'text-rose-400':'text-amber-400'} mt-0.5 text-xs">${kritik?'●':'▲'}</span>
      <span class="text-sm text-slate-300"><span class="text-slate-500">[${u.site}]</span> ${u.mesaj}</span></li>`;
  };
  return `<div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
    <h3 class="text-sm font-semibold text-white mb-2 flex items-center gap-2">Uyarilar
      ${chip(list.length,'rose')}</h3>
    <ul class="divide-y divide-slate-800/60">${list.map(satir).join('')}</ul></div>`;
}

// ---- site karti (genel bakis) ----
function siteKart(s){
  const geoRozet=(ad,v)=>`<span class="text-[11px] px-2 py-0.5 rounded-md border ${v?'bg-violet-500/10 text-violet-300 border-violet-500/20':'bg-slate-800/50 text-slate-500 border-slate-700/40'}">${ad}</span>`;
  const kirik=s.kirikLinkler?.length||0;
  const em=s.eksikMeta||{}; const eksik=(em.title||0)+(em.description||0)+(em.h1||0);
  const sr=(k)=>{const yon=k.pozisyon<k.onceki?'▲':k.pozisyon>k.onceki?'▼':'–';const rk=k.pozisyon<k.onceki?'text-emerald-400':k.pozisyon>k.onceki?'text-rose-400':'text-slate-500';
    return `<div class="flex items-center justify-between text-xs py-1"><span class="text-slate-300 truncate mr-2">${k.kelime}</span>
      <span class="flex items-center gap-1 shrink-0"><span class="font-semibold text-slate-200">#${k.pozisyon}</span><span class="${rk}">${yon}</span></span></div>`;};
  return `<div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 hover:border-slate-700 transition">
    <div class="flex items-start justify-between gap-3 mb-3">
      <div class="min-w-0"><div class="flex items-center gap-2">
        <span class="h-2 w-2 rounded-full ${s.uptime?.durum==='up'?'bg-emerald-400':'bg-rose-400'} inline-block"></span>
        <h3 class="font-semibold text-white truncate">${s.ad}</h3></div>
        <a href="${s.url}" target="_blank" rel="noopener" class="text-xs text-indigo-400 hover:underline truncate block">${kisaUrl(s.url)}</a></div>
      ${halkaSVG(s.seo?.puan??0)}</div>
    <div class="flex flex-wrap gap-1.5 mb-3">
      <span class="text-[11px] ${trendRenk(s.seo?.trend)}">SEO ${s.seo?.trend??'0'}</span>
      ${sslChip(s.ssl)}${chip((s.sayfalar?.taranan??0)+' sayfa','slate')}
      ${kirik?chip(kirik+' kirik link','rose'):chip('link temiz','emerald')}
      ${eksik?chip(eksik+' eksik meta','amber'):chip('meta tam','emerald')}</div>
    <div class="grid grid-cols-2 gap-1.5 mb-3">
      ${durumChip(s.schema?.gecerli,'schema OK','schema yok')}
      ${durumChip(s.sitemap?.varMi&&s.sitemap.erisilemez===0,'sitemap OK','sitemap sorunu')}
      ${durumChip((s.canonical?.eksik||0)+(s.canonical?.hatali||0)===0,'canonical OK','canonical sorunu')}
      ${durumChip(!s.hreflang?.sorun,'hreflang OK','hreflang sorunu')}</div>
    <div class="mb-3"><p class="text-[11px] text-slate-500 mb-1">AI gorunurlugu (GEO)</p>
      <div class="flex gap-1.5">${geoRozet('ChatGPT',s.geo?.chatgpt)}${geoRozet('Perplexity',s.geo?.perplexity)}${geoRozet('Gemini',s.geo?.gemini)}</div></div>
    ${s.siralama?.length?`<div class="border-t border-slate-800 pt-2"><p class="text-[11px] text-slate-500 mb-1">Anahtar kelime siralamasi</p>${s.siralama.slice(0,4).map(sr).join('')}</div>`:`<div class="border-t border-slate-800 pt-2 text-[11px] text-slate-600">siralama verisi yok</div>`}
  </div>`;
}

// ============ YONLENDIRME ============
function menuCiz(){
  const buton = (m) => {
    const rozet = m.id==='uyarilar' && VERI.uyarilar?.length ? `<span class="ml-auto text-[10px] px-1.5 rounded bg-rose-500/20 text-rose-300">${VERI.uyarilar.length}</span>`
      : m.id==='degisim' && VERI.degisiklikler?.length ? `<span class="ml-auto text-[10px] px-1.5 rounded bg-indigo-500/20 text-indigo-300">${VERI.degisiklikler.length}</span>`
      : m.id==='oneri' ? `<span class="ml-auto text-[10px] px-1.5 rounded bg-amber-500/20 text-amber-300">${tumOneriler().length}</span>` : '';
    return `<button data-id="${m.id}" onclick="git('${m.id}')" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition">
      <span class="w-4 text-center text-slate-500">${m.ikon}</span><span>${m.ad}</span>${rozet}</button>`;
  };
  el('nav').innerHTML = MENU_GRUPLARI.map(g =>
    `<p class="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">${g.grup}</p>` +
    g.items.map(buton).join('')
  ).join('');
}

function git(id){
  AKTIF = id;
  const m = MENU.find(x=>x.id===id);
  el('sayfaBaslik').textContent = m.ad;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('nav-aktif', b.dataset.id===id));
  el('icerik').innerHTML = VIEWS[id] ? VIEWS[id]() : bosDurum('bolum bulunamadi');
  el('icerik').scrollTop = 0;
  menuKapat();
}
window.git = git;

function aramaYap(v){ ARAMA = (v||'').toLowerCase().trim(); if(['genel','oneri','siteler','kirik','denetim','kelime','geo','hiz','indeks','botlar','rakip','iclink','gap'].includes(AKTIF)) git(AKTIF); }
window.aramaYap = aramaYap;

function menuAc(){ el('yanmenu').classList.remove('-translate-x-full'); el('perde').classList.remove('hidden'); }
function menuKapat(){ if(window.innerWidth<1024){ el('yanmenu').classList.add('-translate-x-full'); el('perde').classList.add('hidden'); } }
window.menuAc=menuAc; window.menuKapat=menuKapat;

function siteEkleBilgi(){
  git('ayarlar');
  alert('Yeni site eklemek icin sites.config.json dosyasindaki "siteler" dizisine yeni blok ekleyip aktif:true yap. Panel ve tum script\'ler otomatik kapsar.');
}
window.siteEkleBilgi=siteEkleBilgi;

// ============ BASLAT ============
async function veriYukle(){
  try{
    const r = await fetch('data/data.json',{cache:'no-store'});
    if(!r.ok) throw new Error('http '+r.status);
    const d = await r.json();
    if(!d._not) el('veriRozet').classList.add('hidden');
    return d;
  }catch(e){
    if(window.SEO_FALLBACK) return window.SEO_FALLBACK;
    throw e;
  }
}

(async () => {
  try{
    VERI = await veriYukle();
    const t = new Date(VERI.guncelleme);
    el('menuGuncelleme').textContent = 'Guncelleme: ' + (isNaN(t)?VERI.guncelleme:t.toLocaleString('tr-TR'));
    menuCiz();
    git('genel');
  }catch(e){
    el('icerik').innerHTML = bosDurum('Veri yuklenemedi. Panel\'i sunucuyla ac: npx serve · ('+e.message+')');
  }
})();
