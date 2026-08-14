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

`sites.config.json` içindeki `siteler` dizisine yeni blok ekle, `aktif: true` yap. Panel ve tüm script'ler otomatik kapsar — kod değişmez.

## Çalıştırma

Panel'i yerelde görmek için (fetch çalışsın diye küçük sunucu):

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
- [ ] Aşama 3 — Google Search Console (gerçek sıralama + anahtar kelime + içerik boşluğu)
- [ ] Aşama 4 — AI içerik üretici (Auto SEO Blog) — Gemini/Groq free tier veya Claude API
- [ ] Aşama 5 — GEO/AI bot takibi + Telegram uyarı + PDF rapor

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
