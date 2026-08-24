# SEO / GEO Takip Paneli

5 aktif site için tek panelden SEO + GEO takibi. Statik HTML + kendi CSS'i (frontend, framework yok),
Node.js script'leri (otomasyon), ortada tek `data/data.json` buluşma noktası.
Tamamen ücretsiz çalışacak şekilde tasarlandı (GitHub Actions + GitHub Pages).

## Mimari

```
Panel (index.html + panel.css) →  data/data.json  ←  scripts/*.js (Node)
        okur                        tek kaynak            yazar
```

## Klasörler

- `index.html` — panel arayüzü
- `assets/app.js` — data.json'u okuyup çizen kod
- `assets/sorun-katalogu.js` — denetim bulgularının tek kaydı (seviye + neden önemli + nasıl düzeltilir)
- `assets/oneri-motoru.js` — öneri/değerlendirme motoru (panel + rapor + Telegram ortak kullanır)
- `assets/saglik-motoru.js` — tematik sağlık skorları (Site Sağlığı bölümünün hesabı)
- `scripts/lib/robots.js` — robots.txt ayrıştırıcı + yol eşleştirici (AI bot erişimi buradan çıkar)
- `scripts/lib/sorun-tespit.js` — saf tespit fonksiyonları (yinelenen içerik, başlık hiyerarşisi, tıklama derinliği…)
- `scripts/mcp.js` — MCP sunucusu: panel verisini AI ajanlarına açar
- `scripts/baglam.js` — proje hafızası CLI'si (`data/baglam/<siteId>.md`)
- `test/` — kasten bozuk fixture site + birim/uçtan uca testler (`npm test`)
- `assets/fallback-data.js` — `file://` ile açınca kullanılan örnek veri
- `data/data.json` — tüm sitelerin son durumu (script'ler üretir)
- `data/history/` — tarih tarih arşiv (trend grafiği + rapor karşılaştırması için)
- `data/raporlar/` — `npm run rapor` çıktısı (kendi kendine yeten HTML raporlar)
- `data/uyari-durumu.json` — Telegram'a nelerin bildirildiği (tekrar bildirmeyi önler)
- `data/baglam/` — site başına kalıcı bağlam (ne iş yapıyor, hedef, rakip, önemli sayfalar)
- `sites.config.json` — sitelerin tanımı (**yeni proje eklemek için burayı düzenle**)
- `scripts/` — tarama, rapor ve uyarı script'leri

## Yeni site ekleme

Üç yol var; hepsi aynı `sites.config.json` dosyasını günceller, panel ve tüm script'ler otomatik kapsar — kod değişmez.

**1) Panelden (en pratik).** `npm run panel` ile aç, sağ üstteki **+ Site** butonuna bas, adresi yaz, kaydet. "Ekledikten sonra taramayı başlat" kutusu işaretliyse tarama arka planda başlar. Ayarlar bölümünden site pasife alınabilir/silinebilir.

> Yayındaki panelde (FTP'ye yüklenen `dist/`) yazma yoktur — orada **+ Site** aynı formu açar ama
> kaydetmek yerine `sites.config.json`'a yapıştırılacak hazır bloğu üretir. Tarama zaten senin
> bilgisayarında çalıştığı için site tanımı da orada yaşamalı.

**2) Terminalden.**

```bash
npm run site-ekle                                   # soru-cevap
npm run site-ekle -- ornek.com                      # ad/id otomatik üretilir
npm run site-ekle -- ornek.com "Örnek Site" tr,en   # ad ve diller elle
npm run site-ekle -- ornek.com --tara               # ekle + hemen tara
npm run siteler                                     # kayıtlı siteleri listele
npm run site-ekle -- --pasif ornek                  # taramadan çıkar
npm run site-ekle -- --aktif ornek                  # tekrar taramaya al
npm run site-ekle -- --sil ornek                    # tamamen sil
```

id ve görünen ad boş bırakılırsa alan adından üretilir, aynı alan adı iki kez eklenemez, `http://` yazmak zorunlu değil.

**3) Elle.** `sites.config.json` içindeki `siteler` dizisine blok ekleyip `aktif: true` yap.

> Not: FTP'ye yüklenen (dist/) sürüm statiktir, dosyaya yazamaz. Orada **+ Site** formu yapıştırmaya hazır JSON bloğunu üretir; asıl ekleme yerelde yapılır.

## Çalıştırma

Panel'i yerelde görmek için (fetch + site ekleme API'si çalışsın diye küçük sunucu):

```bash
npm run panel   # http://localhost:3000
```

Ya da `index.html`'e çift tıkla — örnek veriyle açılır.

Tarama tüm aktif siteleri gezer; tek siteyi tazelemek için:

```bash
npm run crawl -- --site=animare   # diğer siteler data.json'da olduğu gibi kalır
```

## Panel bölümleri

**Genel:** Genel Bakış · Site Sağlığı (tematik kırılım) · Öneriler/Aksiyon (değerlendirme motoru) · Siteler · Değişiklik İzleyici · Uyarılar
**Teknik SEO:** Sorunlar (bulgu kataloğu + CSV) · SEO Denetim · Kırık Linkler · Hız/Core Vitals · İç Linkleme · İndeks Monitörü
**İçerik & Sıralama:** Anahtar Kelime · İçerik Boşluğu · Rakip Analizi (manuel ekleme) · AI İçerik/Blog
**GEO / AI:** GEO Görünürlük · AI Bot Takibi
**Çıktı:** Raporlar (haftalık akıllı özet) · Araçlar (llms.txt/robots/schema üretici) · Ayarlar

## Öneri/değerlendirme motoru

`assets/oneri-motoru.js` içindeki `oneriUret()` her siteyi kurallarla değerlendirir: öncelik (kritik→düşük),
etki/efor skoru, "hızlı kazanım" tespiti. AI gerektirmez, ücretsiz. Kapsam: SSL, kırık link (iç/dış ayrı),
schema (varlık + zorunlu alan), sitemap, meta, ince içerik, llms.txt, hız, iç link, orphan, indeks,
robots.txt (sözdizimi + AI bot erişimi + Content-Signal), kırık/yönlendirilen sayfa, AI bot,
GEO, kelime fırsatı/düşüşü, kanibalizasyon, içerik boşluğu.

Motor tek dosyada ve hem tarayıcıda (panel) hem Node'da (`rapor.js`, `telegram.js`) çalışır —
panelde gördüğün öneri ile rapordaki/Telegram'daki uyarı aynı koddan çıkar, ayrışamaz.

## SEO puanı nasıl hesaplanır

`scripts/crawl.js` içinde, 100'den başlayıp ceza düşen bir heuristik. Ağırlıklı bir model değil.

| Kontrol | Ceza | Tavan |
|---|---|---|
| Kırık **iç** link (404/410) | adet × 3 | −20 (kırıklar toplamı) |
| Kırık **dış** link (404/410 veya doğrulanmış 5xx/bağlantı hatası) | adet × 1 | " |
| Eksik meta description | adet × 1 | −12 |
| Eksik title | adet × 2 | −8 |
| Eksik H1 | adet × 1 | −8 |
| Geçerli schema yok | −8 | — |
| Sitemap yok | −8 | — |
| robots.txt yok | −4 | — |
| Canonical eksik | adet | −6 |
| Sayfa başına iç link < 5 | −5 | — |
| Orphan sayfa | adet | −6 |
| 10'dan fazla alt eksik | −4 | — |
| Tracking kodu yok | −4 | — |
| Yanıt süresi (taranan sayfaların **medyanı**) | > 1500ms: −3 · > 3000ms: −6 | — |
| **Schema alan eksiği** (oransal) | sorunlu sayfa oranı × 10 | −10 |
| **İnce içerik** (< 200 kelime, oransal) | ince sayfa oranı × 8 | −8 |
| **llms.txt yok** | −2 | — |

Son üç kontrol **oransal**: 30/60 sayfa ile 300/600 sayfa aynı cezayı alır. Üstteki eski kontroller
hâlâ mutlak sayıya bakıyor — bilinçli fark, dönüştürülmesi ayrı bir iş.

Kırık linklerde iki koruma var: (1) kendi sitendeki 404 ile başkasının sunucusundaki hata aynı
ağırlıkta değil, (2) geçici kodlar (5xx / bağlantı hatası) **ancak iki tarama üst üste kırıkken**
sayılır — tek seferlik kesinti puanı oynatmaz. Doğrulanmamışlar panelde görünür ama puana girmez.

Yanıt süresinde de aynı mantık: tek anasayfa ölçümü çok gürültülü (aynı site bir koşuda 299ms,
diğerinde 4713ms verebiliyor), o yüzden puanlama **taranan tüm sayfaların medyanını** kullanır.
`uptime.yanitMs` anasayfa ölçümü olarak panelde kalır; `uptime.medyanMs` puana giren değerdir.

> Bu puan **Semrush Site Health ile karşılaştırılabilir değildir.** Semrush ~101 kontrolün ağırlıklı
> geçme oranını verir; buradaki 16 kontrolün sabit ceza toplamıdır. İki sayının yakın çıkması tesadüftür.

## Sorun kataloğu (Teknik SEO → Sorunlar)

Denetim bulgularının tek kaydı `assets/sorun-katalogu.js`'te. Her bulgu tipi bir kez tanımlanır —
**seviye** (kritik/uyarı/bilgi), **neden önemli**, **nasıl düzeltilir**, **puana giriyor mu** — ve
panel, haftalık rapor, MCP aynı cümleleri okur. Eskiden aynı sorun üç yerde üç farklı şekilde
yazılıydı; artık ayrışamaz.

Tespitin kendisi `scripts/lib/sorun-tespit.js`'te ve **saf fonksiyon**: ağ/dosya/DOM yok, ayrıştırılmış
sayfa girer, bulgu çıkar. Bu yüzden testlenebilir (bkz. aşağıdaki test bölümü).

Kapsanan bulgular (33 tip):

| Grup | Bulgular |
|---|---|
| Head & başlık | title yok/uzun/kısa · description yok/uzun/kısa · H1 yok · çoklu H1 · başlık seviyesi atlama |
| İçerik | ince içerik · yinelenen title · yinelenen description · **yinelenen gövde içeriği** · görsel alt eksik |
| İndekslenebilirlik | canonical yok · **çelişkili canonical** · **canonical başkasını gösteriyor** · noindex (meta **ve X-Robots-Tag**) |
| HTTP & link | kırık iç link · 4xx · 5xx · **bot doğrulaması/403 ile engellenen** · öksüz sayfa · **giden link yok** |
| Yönlendirme | **yönlendirme zinciri** · **yönlendirme döngüsü** |
| Yapı & hız | **tıklama derinliği > 3** · **yavaş sunucu yanıtı** |
| Diğer | schema yok · schema zorunlu alan eksiği · llms.txt yok · robots.txt sözdizimi · robots tamamen kapalı |

**Kalın** olanlar yeni. Panelde seviyeye göre filtrelenir ve **CSV** olarak dışa aktarılır.

> **Yeni kontroller SEO puanına GİRMEZ.** Puan formülü, eski taramalarla karşılaştırılabilirliği
> bozmamak için kasten dondurulmuş durumda; yeni bulgular önce raporlanır. Panelde ve raporda
> `puana girmiyor` etiketi taşırlar. Puana dahil etmek istersen `sorun-katalogu.js`'te `puana: true`
> yap, cezayı `crawl.js`'e ekle, **ve** `saglik-motoru.js`'i güncelle (test mutabakatı zorlar).

## Testler (`npm test`)

```bash
npm test                          # birim + uçtan uca, ~11 sn
node --test test/birim.test.js    # sadece birim (ms)
```

Üç dosya:

- **`test/fixture.js`** — kasten bozuk bir test sitesi. Her sayfa tek bir SEO hatası yapar
  (title yok, yönlendirme döngüsü, öksüz sayfa, X-Robots-Tag noindex, 2.3 sn geciken yanıt…).
  Sayfalar bellekte durur, dosya değil: 404/500/403, yönlendirme ve HTTP başlığı statik dosyayla üretilemez.
- **`test/birim.test.js`** — tespit fonksiyonları ve katalog bütünlüğü.
- **`test/ucbasa.test.js`** — **gerçek `crawl.js`'i** fixture siteye doğrultur ve
  `BEKLENEN` listesindeki her bulgunun yakalandığını doğrular. Geçici bir kökte çalışır
  (`SEOTAKIP_KOK`), gerçek `data/data.json`'a dokunmaz. Son testte fixture sunucusu
  `challengeAc()` ile WAF moduna geçer: tarama ikinci kez koşar ve **eski verinin
  ezilmediği** doğrulanır.

Fikir OpenSEO'nun [badseo.dev](https://github.com/every-app/open-seo)'inden. İlk koşuşta iki gerçek hata yakaladı:

1. `saglik-motoru.js`, `crawl.js`'te **hiç olmayan** bir cezayı (sitemap'te erişilemez URL)
   uyguluyordu — "✓ birebir tutuyor" satırı yanlış söylüyordu. Hiçbir gerçek sitede erişilemez
   sitemap URL'i olmadığı için yıllarca görünmemişti.
2. Yönlendirme döngüsü tespiti sondaki eğik çizgiyi normalize ettiği için `/tr → /tr/` gibi
   **meşru** yönlendirmeleri döngü sanıyordu (bir site "0 sayfa tarandı" ile bitti).
   `test/ucbasa.test.js` artık bu senaryoyu ayrıca bekliyor.

## WAF geçiş anahtarı (Cloudflare vb.)

Sitelerin önünde bot koruması varsa tarayıcı challenge sayfasına düşer ve tarama
boş veri üretir (bkz. alttaki sağlık kontrolü). Çözüm, User-Agent'a izin vermek
**değil** — onu herkes taklit edebilir, WAF'ta herkese açık kapı bırakırsın.
Bunun yerine gizli bir başlık:

1. Uzun rastgele bir değer üret: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`
2. `.env` dosyasına ekle: `SEOTAKIP_ANAHTAR=<deger>` (dosya `.gitignore`'da)
3. GitHub → Settings → Secrets and variables → Actions → `SEOTAKIP_ANAHTAR` olarak ekle
   (gece taraması bunu `tarama.yml` üzerinden okur)
4. Her Cloudflare zone'unda: Security → Security rules → Create rule → Custom rules
   - Expression: `(http.request.headers["x-seotakip-anahtar"][0] eq "<deger>")`
   - Action: **Skip** → All remaining custom rules + Rate limiting + Managed rules
     + Super Bot Fight Mode + (products) Browser Integrity Check, Security Level, User Agent Blocking
   - Kuralı listenin en üstüne al

`crawl.js` başlığı **yalnızca `sites.config.json`'daki kendi host'larımıza** gönderir;
kırık link kontrolü dış sitelere de istek attığı için anahtar oralara sızmasın diye.
Anahtar tanımlı değilse başlık hiç gönderilmez, tarama normal çalışır.

> Cloudflare Free planında 5 custom rule ve Skip action var — ek ücret gerekmez.
> Tek istisna: Free plandaki **Bot Fight Mode** skip edilemez; Security → Bots'tan
> kapatman gerekir (Pro'daki Super Bot Fight Mode skip edilebilir).

## Tarama sağlık kontrolü (engellenen taramalar)

`scripts/lib/tarama-dogrula.js` her taramanın sonucunu **önceki taramayla** karşılaştırır.
WAF/bot doğrulaması (Cloudflare "Just a moment…" gibi) tarayıcıyı ara sayfaya düşürdüğünde
sonuç teknik olarak geçerli görünür — 200 döner, HTML gelir — ama içi boştur. Bu veri iyi
verinin üstüne yazılırsa panel hayali sorunlar gösterir.

Bakılan sinyaller:

| Kod | Anlamı |
|---|---|
| `sayfa-cokusu` | Önceki ≥10 sayfayken bu sefer ≤1 sayfa tarandı — **tek başına yeterli** |
| `sayfa-dususu` | Sayfa sayısı %80'den fazla düştü |
| `sitemap-bos` | sitemap.xml eskiden URL veriyordu, şimdi 0 (XML yerine HTML dönmüş) |
| `robots-kayboldu` | robots.txt düz metin yerine HTML döndü, "yok" sayıldı |
| `icerik-bos` | Ortalama kelime 100+'dan 30'un altına düştü |
| `link-kayboldu` | Ortalama iç link 5+'tan 0'a düştü |

`sayfa-cokusu` veya **en az iki** sinyal varsa tarama başarısız sayılır: o sitenin
`data.json` kaydı **son başarılı taramadan olduğu gibi korunur**, üzerine `taramaHatasi`
işareti konur. Panelde kartta/tabloda "tarama başarısız" rozeti, Öneriler'de kritik bir
satır, Telegram'da acil uyarı çıkar. Puan, trend ve sorun listesi güncellenmez.

Tek sinyal taramayı çöpe atmaz — robots.txt gerçekten silinmiş olabilir. İlk taramada
(kıyaslanacak temel yokken) sonuç her hâlükârda kabul edilir, yoksa yeni eklenen site
hiç kaydedilemez.

> 23 Ağustos 2026: Cloudflare, GitHub Actions runner'ını challenge sayfasına düşürdü;
> beş sitenin de anasayfası 8 kelimelik ara sayfa olarak geldi, hepsi "1 sayfa" tarandı.
> Puanlar 95 → 66'ya indi, panel "Ortalama 0 iç link/sayfa" gibi uyarılar üretti. Bu kontrol
> o olaydan sonra eklendi; `test/ucbasa.test.js` senaryoyu birebir tekrarlar.

## MCP sunucusu (`npm run mcp`)

Panel verisini AI ajanlarına açar — Claude Code, Codex, OpenClaw. Ek paket yok: MCP, stdio
üzerinde satır başına bir JSON-RPC mesajıdır.

Bu klasörde `.mcp.json` var, Claude Code burada açıldığında otomatik bağlanır. Elle eklemek için:

```bash
claude mcp add seotakip -- node /tam/yol/seotakip/scripts/mcp.js
```

Araçlar:

| Araç | Ne verir |
|---|---|
| `siteler_listele` | Tüm siteler: puan, trend, sayfa, kritik/uyarı/bilgi sayısı |
| `sorunlar` | Bulgular — site/seviye filtresiyle, neden + nasıl düzeltilir metniyle |
| `oneriler` | Önceliklendirilmiş aksiyon listesi, hızlı kazanım filtresiyle |
| `site_detay` | Tek sitenin tam durumu |
| `saglik` | Puanın tematik kırılımı + mutabakat satırı |
| `kelimeler` | Search Console sıralama + fırsat kelimeleri |
| `gecmis` | Puanın tarih tarih seyri |
| `baglam_oku` / `baglam_yaz` | Proje hafızası (aşağıda) |

Araçlar JSON değil **düz metin** döner: ajanın okuması kolay, token'ı az.

## Proje hafızası (`npm run baglam`)

Panel teknik durumu ölçüyordu ama "bu site ne iş yapıyor, hedefi ne, rakibi kim, hangi sayfa
önemli, nasıl bir dille yazıyoruz" hiçbir yerde yazılı değildi — her yeni oturumda (sen ya da bir
AI ajanı) baştan soruluyordu.

```bash
npm run baglam                        # kayıtlı bağlamları listele
npm run baglam -- animare             # göster (yoksa şablon oluştur)
npm run baglam -- animare --duzenle   # $EDITOR ile aç
```

`data/baglam/<siteId>.md` — düz markdown. MCP üzerinden ajanlar da okuyup yazabilir
(`baglam_oku` / `baglam_yaz`), böylece öğrenilen kalıcı bilgi bir sonraki oturuma taşınır.

## Site Sağlığı (tematik halkalar)

Tek puan "neden 80?" sorusunu cevaplamıyordu. **Site Sağlığı** bölümü aynı puanı başlıklara ayırır.
Hesap `assets/saglik-motoru.js`'te; öneri motoru gibi hem tarayıcıda hem Node'da çalışır.

İki tür kategori var, karıştırılmamalı:

| Tür | Ne demek | Kategoriler (bütçe = düşebilecek en çok puan) |
|---|---|---|
| **puanı etkiler** | Cezaları doğrudan yukarıdaki tablodan gelir | Taranabilirlik (38) · On-page & Meta (36) · Markup/Schema (18) · İç Linkleme (11) · İçerik Derinliği (8) · Sunucu Yanıtı (6) · AI Hazırlığı (2) |
| **ayrı ölçüm** | SEO puanına **girmez**, kendi eşiğiyle ölçülür | HTTPS & SSL · Site Hızı · Core Web Vitals · Uluslararası SEO (hreflang) · İndeks Durumu |

Halka değeri = `100 × (1 − kategori cezası ÷ bütçe)`. "Puanı etkiler" kategorilerinin cezaları
toplandığında **100 − `seo.puan`** çıkar; tek site seçiliyken kartın üstünde bu mutabakat yazar
(`✓ crawl.js ile birebir tutuyor`). Tutmuyorsa iki dosyadaki formül ayrışmış demektir —
`crawl.js`'teki puanlama bloğunu değiştirirken `saglik-motoru.js`'i de güncelle.

Dürüstlük notları (panelde de yazıyor):

- **Taranan sayfalar** kartı her URL'yi tek bir duruma koyar: sağlam / sorunlu / kırık /
  yönlendirme / robots ile engelli. Bu beşi örtüşmez, toplamı taranan URL sayısını verir.
  Altındaki **sorun türleri** (ince içerik, schema alanı, eksik meta…) ise çakışır — bir sayfa
  aynı anda birkaçında olabilir.
- **Core Web Vitals** kaynağı `lab` (Lighthouse) ise gerçek kullanıcı (CrUX) verisi değildir; lab
  ölçümünde INP alınamaz, o yüzden hesaba katılmaz.
- Portföy görünümünde bir kategori sitelerin sadece bir kısmında ölçülebildiyse halkanın yanında
  kapsam rozeti çıkar (ör. `1/5 site`) — eksik ölçüm tam gibi görünmesin.

## robots.txt ve AI bot erişimi

`scripts/lib/robots.js` robots.txt'i Google'ın spesifikasyonuna göre ayrıştırır: aynı user-agent'a
ait gruplar birleştirilir (Cloudflare'in yönettiği dosyalarda iki ayrı `User-agent: *` bloğu
olabiliyor), eşleşmede **en uzun kural kazanır**, eşitlikte `Allow` üstündür, `*` ve `$` desteklenir.

Bundan üç şey çıkıyor:

1. **AI bot erişimi** — GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot,
   Google-Extended, Applebot-Extended, CCBot, Bytespider, meta-externalagent + karşılaştırma için
   Googlebot/Bingbot. Panelde "AI aramaya kapalı" kartı ve bot × site tablosu bunu gösterir.
   Bir bot engelliyse o motor seni cevabında kaynak gösteremez.
2. **Kendi taramamız** — robots.txt bize kapattığı sayfayı **taramıyoruz**; o sayfalar "engelli"
   olarak raporlanır. Site tamamen kapalıysa kritik uyarı çıkar.
3. **Sitemap keşfi** — robots.txt'te bildirilen `Sitemap:` satırları da okunur. Bu sayede ayrı
   dosyada duran ürün/blog haritaları da denetime girer (Luxeva'nın `/urun-sitemap.xml`'i böyle
   bulundu: 66 ürün sayfası daha).

`Content-Signal` gibi standart dışı satırlar hata sayılmaz, ayrıca gösterilir (`ai-train=no` gibi
bir bildirim varsa panel bunu yazar).

> **AI botunu engellemek puanı düşürmez.** Bilinçli bir tercih olabilir; panel bunu ölçüm ve öneri
> olarak gösterir, SEO puanına karıştırmaz. Aynı şekilde robots.txt sözdizimi hataları ve kırık
> sayfalar da şimdilik puana girmez — puan formülü kasten değiştirilmedi ki eski taramalarla
> karşılaştırılabilirliği bozulmasın.

## Durum

- [x] Aşama 1 — Panel iskeleti + yönetim barı + 19 bölüm
- [x] Öneri/değerlendirme katmanı + araç üreticiler (llms.txt/robots/schema) + manuel rakip
- [x] Aşama 2 — Crawler (`scripts/crawl.js`): 5 canlı siteyi tarar → kırık link, meta, SSL, sitemap,
      schema (zorunlu alan doğrulaması dahil), canonical, iç link, orphan, on-page, tracking,
      kelime sayısı, llms.txt. `npm run crawl` ile çalışır.
- [~] Hız / Core Web Vitals — `scripts/pagespeed.js` hazır; **ücretsiz PageSpeed API anahtarı** bekliyor (aşağıya bak)
- [~] Otomasyon — `.github/workflows/tarama.yml` hazır; GitHub'a **push** bekliyor
- [~] Aşama 3 — Search Console (`scripts/searchconsole.js`) hazır; **servis hesabı** bekliyor (aşağıda)
- [x] Aşama 4 — AI içerik üretici: Claude yolu çalışır (panelden prompt → `scripts/icerik-ekle.js`);
      Gemini yolu (`scripts/aiblog.js`) yedek, **API anahtarı** bekliyor (aşağıda)
- [x] Aşama 5 — GEO/AI bot takibi (`geo-ekle.js` + `botlog.js`), HTML/PDF rapor (`rapor.js`),
      Telegram uyarı (`telegram.js`; **bot token'ı** bekliyor — aşağıda)

## AI İçerik / Auto SEO Blog

**A — Claude ile (önerilen, API anahtarı yok):**

1. Panelde "AI İçerik / Blog" → önerilen konu satırında **"Claude promptu kopyala"**
2. Bu repoda açık Claude Code oturumuna yapıştır → içerik üretilir
3. Claude yazıyı frontmatter'lı markdown yapar ve `node scripts/icerik-ekle.js <dosya>` ile panele ekler
   (elle de çalıştırabilirsin; `.md` frontmatter veya `.json` kabul eder)

**B — Gemini ile (yedek, ücretsiz free tier):**

1. [Google AI Studio → Get API key](https://aistudio.google.com/apikey) → ücretsiz anahtar al
2. `.env`'e ekle: `GEMINI_API_KEY=SENIN_ANAHTARIN` (istersen `GEMINI_MODEL=gemini-2.0-flash`)
3. Üretilebilecek fırsat kelimelerini listele: `npm run icerik`
4. Bir konu için içerik üret: `npm run icerik -- <siteId> "<anahtar kelime>"`
5. Tüm sitelerin ilk fırsatı için toplu: `node scripts/aiblog.js --firsatlar`

Üretilen içerik: `data/icerikler/<slug>.md` (sitene yapıştır) + panelde "Üretilen içerikler"de listelenir
(başlık, meta, gövde markdown, FAQ). Gemini free tier günde bol miktarda ücretsiz istek verir.

## Search Console kurulumu (ücretsiz, gerçek sıralama + anahtar kelime)

Servis hesabı yöntemi — interaktif giriş yok, otomasyonda da çalışır:

1. [Google Cloud Console](https://console.cloud.google.com/) → yeni proje → **"Search Console API"yi etkinleştir**
2. **IAM & Admin → Service Accounts → Create** → oluştur → **Keys → Add key → JSON** indir
3. İnen JSON'u proje köküne **`gsc-key.json`** olarak koy (gitignore'da, repoya gitmez)
4. Her Search Console property'sinde: **Ayarlar → Kullanıcılar ve izinler → Kullanıcı ekle**
   → servis hesabının e-postası (`xxx@proje.iam.gserviceaccount.com`) → **"Tam"** izin ver
   (sıralama için "Sınırlı" yeter, ama **İndeks Monitörü "Tam" ister** — aşağıya bak)
5. Çalıştır: `npm run gsc`

Doldurur: her sitenin gerçek **sıralaması** (Anahtar Kelime bölümü) ve **fırsat kelimeleri**
(İçerik Boşluğu — 2. sayfadaki yüksek gösterimli kelimeler).

**Otomasyon için:** aynı JSON'un tamamını GitHub repo secret'ı olarak `GSC_KEY_JSON` adıyla ekle;
workflow gece taramasında sıralamayı da otomatik çeker.

## İndeks Monitörü (`npm run indeks`)

Sayfaların Google'da gerçekten indeksli olup olmadığını **URL Inspection API** ile sayfa sayfa sorar
ve indekslenmeyenler için *nedeni* + *ne yapılacağını* panele yazar.

> Neden ayrı script: GSC Sitemaps API'sindeki `indexed` alanı kullanımdan kalktı, hep `0` dönüyor.
> Ondan hesaplanan "X sayfa indekslenmemiş" sayısı yanlıştı — o yol tamamen kaldırıldı.

- **İzin:** servis hesabına **"Tam"** izni şart. "Sınırlı" ile API `403` döner (script bunu açıkça söyler).
- **Kota:** site başına günde 2000 URL. Sonuçlar `data/indeks-cache.json`'da tutulur; her çalışmada
  yalnızca **7 günden eski** kayıtlar tazelenir, çalışma başına site başına **100 URL** sorulur.
  Böylece gece taraması kotayı yakmaz, liste birkaç günde tam tur atar.
- **Parametreler:** `--limit=300` (bu çalışmada kaç URL), `--tazelik=3` (kaç günde bir tazele),
  `--site=animare` (tek site).

Panelde **Teknik SEO → İndeks Monitörü**: site başına indeksli/aksiyon gereken sayısı + neden kırılımı.
`⚠` işaretli nedenler gerçek problem; `·` işaretliler ("Alternatif sayfa", "Yönlendirme") normaldir ve
öneri üretmez.

## PageSpeed API anahtarı (ücretsiz, ~2 dk)

Hız/Core Web Vitals bölümü bu anahtarı ister (Google anahtarsız erişimi kapattı, 429 döner):

1. https://developers.google.com/speed/docs/insights/v5/get-started → "Get a Key"
   (veya Google Cloud Console → APIs & Services → Credentials → API Key; "PageSpeed Insights API"yi etkinleştir)
2. Proje kökünde `.env` dosyası oluştur: `cp .env.example .env`
3. İçine yapıştır: `PAGESPEED_KEY=SENIN_ANAHTARIN`
4. Çalıştır: `npm run hiz`

Günde 25.000 istek ücretsiz. `.env` gitignore'da — repoya gitmez.

## Raporlar (`npm run rapor`)

Son tarama verisinden kendi kendine yeten tek bir HTML dosyası üretir — `data/raporlar/` altına.
Panel → **Raporlar** bölümünde "Aç / PDF" düğmesiyle açılır.

```bash
npm run rapor                     # haftalık, tüm siteler
npm run rapor -- aylik            # aylık (30 gün önceki anlık görüntüyle karşılaştırır)
npm run rapor -- --site=animare   # tek site
```

İçinde: yönetici özeti, site skor tablosu (geçen haftaya göre farkla), kritik+yüksek aksiyon
listesi, hızlı kazanımlar, değişiklikler, site detayları, açık uyarılar.

**PDF:** ek paket kurulmaz. Rapor tarayıcıda açılır → sağ üstteki **"PDF kaydet"** → yazdırma
penceresinde hedefi "PDF olarak kaydet" seç. Sayfa düzeni A4'e göre ayarlı, düğme çıktıya girmez.

Karşılaştırma verisi `data/history/YYYY-MM-DD.json` dosyalarından gelir; hedef tarihte dosya
yoksa ona en yakın eski dosya kullanılır ve rapor başlığında hangi tarihle kıyaslandığı yazar.

## Telegram uyarı (`npm run uyar`)

Kritik durumları telefonuna düşürür. Ücretsiz, ek paket yok.

1. Telegram'da **@BotFather** → `/newbot` → bot adını ver → sana bir **token** verir
2. Kendi botunla sohbet aç ve bir mesaj yolla (bot, sen yazmadan sana yazamaz)
3. `https://api.telegram.org/bot<TOKEN>/getUpdates` adresini aç → `"chat":{"id":123456789}`
4. `.env`'e ekle: `TELEGRAM_TOKEN=...` ve `TELEGRAM_CHAT_ID=...`
5. Dene: `npm run uyar -- --test`

```bash
npm run uyar              # sadece DEĞİŞEN durumları yollar (spam yok)
npm run uyar -- --hepsi   # o anki tüm açık kritik durumu yollar
npm run uyar -- --kuru    # hiçbir şey yollamaz, mesajı ekrana basar
```

Bildirilenler: site erişilemiyor, SSL geçersiz/≤14 gün, SEO puanı 10+ düşüş, kırık iç link,
indeks düşüşü, motorun ürettiği kritik öneriler.

Gönderilenler `data/uyari-durumu.json`'da tutulur — aynı sorun her taramada tekrar bildirilmez,
sadece **yeni çıkan** ve **kapanan** maddeler yazılır. Gönderim başarısız olursa durum dosyası
güncellenmez, uyarı bir sonraki çalıştırmada tekrar denenir.

## Otomasyon (GitHub Actions — her gece, bilgisayar kapalıyken)

`.github/workflows/tarama.yml` hazır. Aktifleştirmek için:

1. Bu klasörü bir GitHub reposuna push et (private olabilir)
2. GitHub → repo → Settings → Secrets → Actions → `PAGESPEED_KEY` ekle (opsiyonel, hız için)
3. Actions sekmesinden "Run workflow" ile test et; sonra her gece 06:00 TR otomatik çalışır
4. (Panel yayını için) `.github/workflows/deploy.yml` — tarama biter bitmez `dist/`'i
   hosting'e FTP ile yükler. `FTP_HOST` / `FTP_USER` / `FTP_PASSWORD` secret'larını
   eklemen yeterli; ayrıntı [DEPLOY.md](DEPLOY.md)'de
