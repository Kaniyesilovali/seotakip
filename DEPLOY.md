# Deploy — FileZilla ile manuel (FTP)

Bu panel statik: HTML + CSS + JS + `data.json`. Herhangi bir web sunucusuna (shared hosting,
cPanel, vb.) sadece dosyaları yükleyerek çalışır. PHP/Node/veritabanı gerekmez.

## 🔴 Önce güvenlik — ASLA yükleme

Şu dosyalar **gizli anahtar** içerir, herkese açık sunucuya **kesinlikle yüklenmemeli**:

- `.env` (PageSpeed API anahtarın)
- `gsc-key.json` (Google servis hesabı özel anahtarı)
- `scripts/`, `node_modules/`, `sites.config.json`, `package.json`

Bunları elle seçip yüklememelisin. Onun yerine **hazır `dist/` klasörünü** kullan — içinde
sadece güvenli, herkese açık olması gereken dosyalar var.

## 1. Deploy paketini hazırla

```bash
npm run build
```

Bu, `dist/` klasörünü oluşturur. İçinde **sadece** şunlar olur (hepsi güvenli):

```
dist/
├── index.html
├── .htaccess
├── assets/
│   ├── panel.css
│   ├── oneri-motoru.js
│   ├── saglik-motoru.js
│   ├── app.js
│   └── fallback-data.js
└── data/
    ├── data.json
    └── raporlar/            ← varsa (npm run rapor ile üretilen HTML raporlar)
        ├── 2026-08-15-haftalik.html
        ├── 2026-08-15-haftalik-animare.html    ← tek site raporu
        └── 2026-08-15-aylik.html
```

Build ayrıca `index.html` içindeki varlık adreslerine içerik hash'i ekler
(ör. `assets/app.js?v=d9970bdc` — dosya her değiştiğinde hash de değişir). Bu yüzden **`index.html` ile `assets/` her zaman birlikte
yüklenmeli** — yalnızca birini yüklersen tarayıcı yeni HTML ile eski JS/CSS'i eşleştirip
paneli bozuk açar.

## 2. FileZilla ile yükle

1. FileZilla'yı aç → hosting'inin **FTP bilgileriyle** bağlan (Host, Kullanıcı, Şifre, Port 21)
2. Sağ panelde (sunucu) web köküne gir — genelde **`public_html`** (veya `www` / `htdocs`)
   - Ana alan adında yayınlamak istiyorsan: `public_html/` içine
   - Alt klasörde istiyorsan (ör. `site.com/seo`): `public_html/seo/` oluştur, oraya
3. **Sunucu → Gizli dosyaları göstermeye zorla**'yı işaretle. `.htaccess` nokta ile başlayan
   gizli bir dosya; bu açık değilse FileZilla onu ne solda gösterir ne de yükler
4. Sol panelde (bilgisayarın) **`dist/` klasörünün İÇİNE** gir
5. `dist/` içindeki **her şeyi seç** (index.html, .htaccess, assets, data) → sağ panele **sürükle**
6. Yükleme bitince tarayıcıda alan adını aç — panel açılır

## 3. Veriyi güncelleme (sonraki taramalar)

Panel `data/data.json`'u okur. Yeni tarama sonucunu canlıya yansıtmak için:

```bash
git pull             # gece taraması varsa önce onu al (aşağıya bak)
npm run tara-hepsi   # 5 siteyi tara (crawl + hız + Search Console)
npm run build        # dist/ yenilenir
```

> **`git pull`'u atlama.** GitHub Actions her gece 06:00 TR'de siteleri tarayıp
> `data/data.json`, `data/history/`, `data/raporlar/` ve `assets/fallback-data.js`
> dosyalarını repo'ya geri commit'liyor (`.github/workflows/tarama.yml`). Pull etmeden
> `npm run build` çalıştırırsan `dist/`'e gece taraması değil, yereldeki eski veri girer —
> panelde dünkü tarih görünür. Sadece yayına almak istiyorsan `npm run tara-hepsi`'yi
> hiç çalıştırmadan `git pull && npm run build` yeterli.

Sonra FileZilla'da neyi yükleyeceğin **neyin değiştiğine** bağlı:

| Değişen | Yüklenecek |
|---|---|
| Sadece tarama verisi (`npm run tara-hepsi`) | `dist/data/data.json` → sunucudaki `data/data.json` üzerine |
| Yeni rapor ürettin (`npm run rapor`) | `dist/data/data.json` **ve** `dist/data/raporlar/` klasörü (panel rapora oradan link verir) |
| Panel kodu/tasarımı (`assets/*`, `index.html`) | `dist/index.html` **ve** `dist/assets/` klasörünün tamamı birlikte |
| Emin değilsen | `dist/` içindekilerin hepsi (~460 KB, birkaç saniye) |

FileZilla'da üzerine yazarken çıkan diyalogda **"Overwrite"** + "Always use this action"
seçmen yeterli. Transfer modu **Binary** olsun (Transfer → Transfer Type → Binary);
Auto/ASCII modunda `data.json` bozulabilir.

> İpucu: Bu adımı otomatikleştirmek istersen, hosting FTP bilgilerini kullanan küçük bir
> yükleme script'i de eklenebilir. Şimdilik manuel akış bu.

## Notlar

- Panelin tüm stili kendi `assets/panel.css` dosyasındadır; dışarıdan sadece **Google Fonts**
  (Space Grotesk + Inter) çekilir. Font'a erişilemezse panel yine çalışır, sadece yazı tipi
  sistem font'una düşer.
- **"+ Site" yayında salt-okunur.** Buton formu açar ama sunucuya yazamaz; yerine
  `sites.config.json`'a yapıştırılacak hazır bloğu üretir. Gerçek ekleme kendi bilgisayarında:
  `npm run panel` → **+ Site**, ya da `npm run site-ekle -- ornek.com`. Tarama zaten sende
  çalıştığı için site tanımı da orada yaşar.
- Panel açılışta bir kez `api/siteler` adresini yoklar; statik sunucuda bu **404 döner ve
  normaldir** (panel sessizce salt-okunur moda geçer). Access log'da bu satırı görünce
  endişelenme.
- `.htaccess` (Apache host'larda) `data.json`'u önbelleğe almaz; yeni veriyi yükleyince hemen görünür.
- Nginx host isen `.htaccess` yok sayılır; panel yine çalışır, sadece tarayıcıda sert yenile (Cmd+Shift+R) gerekebilir.
