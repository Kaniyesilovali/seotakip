# SEO / GEO Takip Paneli

5 aktif site için tek panelden SEO + GEO takibi. Statik HTML + Tailwind (frontend),
Node.js script'leri (otomasyon), ortada tek `data/data.json` buluşma noktası.
Tamamen ücretsiz çalışacak şekilde tasarlandı (GitHub Actions + GitHub Pages).

## Mimari

```
Panel (index.html + Tailwind)  →  data/data.json  ←  scripts/*.js (Node)
        okur                        tek kaynak            yazar
```

## Klasörler

- `index.html` — panel arayüzü
- `assets/app.js` — data.json'u okuyup çizen kod
- `assets/fallback-data.js` — `file://` ile açınca kullanılan örnek veri
- `data/data.json` — tüm sitelerin son durumu (script'ler üretir)
- `data/history/` — tarih tarih arşiv (trend grafiği için)
- `sites.config.json` — sitelerin tanımı (**yeni proje eklemek için burayı düzenle**)
- `scripts/` — tarama script'leri (sıradaki aşamada eklenecek)

## Yeni site ekleme

Üç yol var; hepsi aynı `sites.config.json` dosyasını günceller, panel ve tüm script'ler otomatik kapsar — kod değişmez.

**1) Panelden (en pratik).** `npm run panel` ile aç, sağ üstteki **+ Site** butonuna bas, adresi yaz, kaydet. "Ekledikten sonra hemen tara" kutusu işaretliyse tarama arka planda başlar. Ayarlar bölümünden site pasife alınabilir/silinebilir.

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

## Panel bölümleri

**Genel:** Genel Bakış · Öneriler/Aksiyon (değerlendirme motoru) · Siteler · Değişiklik İzleyici · Uyarılar
**Teknik SEO:** SEO Denetim · Kırık Linkler · Hız/Core Vitals · İç Linkleme · İndeks Monitörü
**İçerik & Sıralama:** Anahtar Kelime · İçerik Boşluğu · Rakip Analizi (manuel ekleme) · AI İçerik/Blog
**GEO / AI:** GEO Görünürlük · AI Bot Takibi
**Çıktı:** Raporlar (haftalık akıllı özet) · Araçlar (llms.txt/robots/schema üretici) · Ayarlar

## Öneri/değerlendirme motoru

`assets/app.js` içindeki `oneriUret()` her siteyi kurallarla değerlendirir: öncelik (kritik→düşük),
etki/efor skoru, "hızlı kazanım" tespiti. AI gerektirmez, ücretsiz. Kapsam: SSL, kırık link, schema,
sitemap, meta, hız, iç link, orphan, indeks, AI bot, GEO, kelime fırsatı/düşüşü, kanibalizasyon, içerik boşluğu.

## Durum

- [x] Aşama 1 — Panel iskeleti + yönetim barı + 19 bölüm
- [x] Öneri/değerlendirme katmanı + araç üreticiler (llms.txt/robots/schema) + manuel rakip
- [x] Aşama 2 — Crawler (`scripts/crawl.js`): 4 canlı siteyi tarar → kırık link, meta, SSL,
      sitemap, schema, canonical, iç link, orphan, on-page, tracking. `npm run crawl` ile çalışır.
- [~] Hız / Core Web Vitals — `scripts/pagespeed.js` hazır; **ücretsiz PageSpeed API anahtarı** bekliyor (aşağıya bak)
- [~] Otomasyon — `.github/workflows/tarama.yml` hazır; GitHub'a **push** bekliyor
- [~] Aşama 3 — Search Console (`scripts/searchconsole.js`) hazır; **servis hesabı** bekliyor (aşağıda)
- [~] Aşama 4 — AI içerik üretici (`scripts/aiblog.js`) hazır; **Gemini API anahtarı** bekliyor (aşağıda)
- [ ] Aşama 5 — GEO/AI bot takibi + Telegram uyarı + PDF rapor

## AI İçerik / Auto SEO Blog kurulumu (ücretsiz, Gemini)

1. [Google AI Studio → Get API key](https://aistudio.google.com/apikey) → ücretsiz anahtar al
2. `.env`'e ekle: `GEMINI_API_KEY=SENIN_ANAHTARIN` (istersen `GEMINI_MODEL=gemini-2.0-flash`)
3. Üretilebilecek fırsat kelimelerini listele: `npm run icerik`
4. Bir konu için içerik üret: `npm run icerik -- <siteId> "<anahtar kelime>"`
   (veya panelde "AI İçerik / Blog" bölümünden komutu kopyala)
5. Tüm sitelerin ilk fırsatı için toplu: `node scripts/aiblog.js --firsatlar`

Üretilen içerik: `data/icerikler/<slug>.md` (sitene yapıştır) + panelde "Üretilen içerikler"de listelenir
(başlık, meta, gövde markdown, FAQ). Gemini free tier günde bol miktarda ücretsiz istek verir.

## Search Console kurulumu (ücretsiz, gerçek sıralama + anahtar kelime)

Servis hesabı yöntemi — interaktif giriş yok, otomasyonda da çalışır:

1. [Google Cloud Console](https://console.cloud.google.com/) → yeni proje → **"Search Console API"yi etkinleştir**
2. **IAM & Admin → Service Accounts → Create** → oluştur → **Keys → Add key → JSON** indir
3. İnen JSON'u proje köküne **`gsc-key.json`** olarak koy (gitignore'da, repoya gitmez)
4. Her Search Console property'sinde: **Ayarlar → Kullanıcılar ve izinler → Kullanıcı ekle**
   → servis hesabının e-postası (`xxx@proje.iam.gserviceaccount.com`) → **"Sınırlı"** izin yeter
5. Çalıştır: `npm run gsc`

Doldurur: her sitenin gerçek **sıralaması** (Anahtar Kelime bölümü), **fırsat kelimeleri**
(İçerik Boşluğu — 2. sayfadaki yüksek gösterimli kelimeler) ve **indeks** sayıları (sitemap'ten).

**Otomasyon için:** aynı JSON'un tamamını GitHub repo secret'ı olarak `GSC_KEY_JSON` adıyla ekle;
workflow gece taramasında sıralamayı da otomatik çeker.

## PageSpeed API anahtarı (ücretsiz, ~2 dk)

Hız/Core Web Vitals bölümü bu anahtarı ister (Google anahtarsız erişimi kapattı, 429 döner):

1. https://developers.google.com/speed/docs/insights/v5/get-started → "Get a Key"
   (veya Google Cloud Console → APIs & Services → Credentials → API Key; "PageSpeed Insights API"yi etkinleştir)
2. Proje kökünde `.env` dosyası oluştur: `cp .env.example .env`
3. İçine yapıştır: `PAGESPEED_KEY=SENIN_ANAHTARIN`
4. Çalıştır: `npm run hiz`

Günde 25.000 istek ücretsiz. `.env` gitignore'da — repoya gitmez.

## Otomasyon (GitHub Actions — her gece, bilgisayar kapalıyken)

`.github/workflows/tarama.yml` hazır. Aktifleştirmek için:

1. Bu klasörü bir GitHub reposuna push et (private olabilir)
2. GitHub → repo → Settings → Secrets → Actions → `PAGESPEED_KEY` ekle (opsiyonel, hız için)
3. Actions sekmesinden "Run workflow" ile test et; sonra her gece 06:00 TR otomatik çalışır
4. (Panel yayını için) Settings → Pages → Deploy from branch → panel internetten açılır
