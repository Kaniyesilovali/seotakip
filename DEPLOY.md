# Deploy — otomatik (GitHub Actions → FTP)

Bu panel statik: HTML + CSS + JS + `data.json`. Yayına alma artık **otomatik**:
`.github/workflows/deploy.yml` `npm run build` çalıştırıp `dist/` içeriğini hosting'e
FTP ile yükler. FileZilla'yı elle açman gerekmez (yedek yol olarak aşağıda duruyor).

## Ne zaman kendiliğinden deploy olur

| Tetikleyici | Sonuç |
|---|---|
| `main`'e push (`index.html`, `assets/**`, `data/**`, `scripts/build.js`) | Panel kodu/tasarımı canlıya çıkar |
| Gece taraması bitince (`tarama.yml` başarılı) | Yeni tarama verisi + raporlar canlıya çıkar |
| Actions → **Deploy (FTP)** → Run workflow | Elle tetikleme |

> Gece taraması `data/data.json`, `data/history/`, `data/raporlar/` ve
> `assets/fallback-data.js` dosyalarını repo'ya `[skip ci]` ile commit'liyor. `[skip ci]`
> push tetikleyicisini durdurduğu için deploy'u `workflow_run` ile bağladık — tarama
> **başarıyla** bitince deploy sırayla çalışır. Tarama hata verirse yayına eski veri
> gitmesin diye deploy atlanır.

## 🔴 Güvenlik

`npm run build` yalnızca güvenli dosyaları `dist/`'e kopyalar ve sonunda **sızıntı denetimi**
yapar — `dist/` içinde `.env`, `gsc-key.json`, `sites.config.json` veya `package.json`
bulursa build hata verip çıkar, dolayısıyla deploy da durur. Sunucuya sadece şunlar gider:

```
dist/
├── index.html
├── .htaccess
├── assets/          (panel.css, app.js, oneri-motoru.js, saglik-motoru.js, fallback-data.js)
└── data/
    ├── data.json
    └── raporlar/    (varsa üretilmiş HTML raporlar)
```

Build ayrıca `index.html` içindeki varlık adreslerine içerik hash'i ekler
(ör. `assets/app.js?v=d9970bdc`). `index.html` ile `assets/` her zaman **birlikte**
yüklendiği için tarayıcı yeni HTML ile eski JS/CSS'i eşleştiremez.

## Tek seferlik kurulum — GitHub Secrets

FTP bilgilerini repo'ya **yazma**; GitHub'ın şifreli kasasına gir.

**GitHub → repo → Settings → Secrets and variables → Actions → Secrets → New repository secret**

| Secret | Değer | Nereden |
|---|---|---|
| `FTP_HOST` | `ftp.alanadin.com` veya sunucu IP'si | FileZilla'daki **Host** alanı |
| `FTP_USER` | FTP kullanıcı adı | FileZilla'daki **Kullanıcı** |
| `FTP_PASSWORD` | FTP şifresi | FileZilla'daki **Şifre** |

Varsayılanlar sana uymuyorsa aynı ekrandaki **Variables** sekmesine ekle (bunlar gizli değil,
sadece ayar):

| Variable | Varsayılan | Ne zaman değiştir |
|---|---|---|
| `FTP_DIR` | `public_html/` | Panel alt klasörde yayındaysa: `public_html/seo/` |
| `FTP_PROTOCOL` | `ftp` | Hosting açık FTP kabul etmiyorsa: `ftps` (FileZilla'da "Explicit FTP over TLS" ile bağlanıyorsan bunu seç) |
| `FTP_PORT` | `21` | Host farklı port veriyorsa |

> `dangerous-clean-slate` kapalı: yükleme `dist/` dışındaki dosyaları **silmez**.
> Sunucuda başka bir sitenin dosyaları varsa onlara dokunulmaz.

## İlk deploy'u çalıştır ve doğrula

1. **Actions** sekmesi → sol menüden **Deploy (FTP)** → sağdan **Run workflow** → `main`
2. Akış yeşile dönene kadar bekle (~1 dk). "FTP ile yukle" adımını açıp yüklenen dosya
   listesini görebilirsin
3. Tarayıcıda alan adını aç, sert yenile (Cmd+Shift+R) — panel güncel tarihi göstermeli

İlk çalıştırmada eylem sunucuya `.ftp-deploy-sync-state.json` bırakır; sonraki deploy'larda
**sadece değişen dosyaları** yükler, bu yüzden çok hızlıdır.

### Sorun çıkarsa

| Hata | Sebep / çözüm |
|---|---|
| `530 Login incorrect` | `FTP_USER` / `FTP_PASSWORD` yanlış. cPanel'de ana hesap değil, FTP hesabı kullanıcı adı genelde `kullanici@alanadi.com` biçimindedir |
| `ECONNREFUSED` / zaman aşımı | Host açık FTP'yi kapatmış → `FTP_PROTOCOL` variable'ını `ftps` yap |
| Yükleniyor ama panel eski | `FTP_DIR` yanlış klasörü gösteriyor. FileZilla'da bağlanıp `index.html`'in gerçekte hangi klasörde olduğuna bak |
| Build adımında `✕ GUVENLIK` | `dist/`'e sır dosyası girmiş — deploy bilerek durduruldu, `scripts/build.js` içindeki `DOSYALAR` listesine bak |

## Yeni günlük akış

Artık yayına almak için elle bir şey yapman gerekmiyor. Kendi bilgisayarında tarama
çalıştırdıysan sadece commit'leyip push'la:

```bash
npm run tara-hepsi   # istersen — gece taraması bunu zaten yapıyor
npm run build        # istersen — sadece yerelde önizleme için
git add data assets/fallback-data.js
git commit -m "tarama"
git push             # ← deploy buradan itibaren otomatik
```

`git pull`'u yine de alışkanlık edin: gece taraması repo'ya commit attığı için yerelin
geride kalır ve push çakışır.

---

## Yedek yol — FileZilla ile elle deploy

Actions çalışmıyorsa (hosting FTP'yi kapattı, secret süresi doldu vb.) eski yöntem hâlâ geçerli:

```bash
git pull && npm run build
```

1. FileZilla → hosting FTP bilgileriyle bağlan (Host, Kullanıcı, Şifre, Port 21)
2. **Sunucu → Gizli dosyaları göstermeye zorla**'yı işaretle — `.htaccess` nokta ile başlar,
   bu açık değilse FileZilla onu ne gösterir ne yükler
3. Sağ panelde web köküne gir (genelde `public_html`)
4. Sol panelde **`dist/` klasörünün İÇİNE** gir → içindeki **her şeyi** seç → sağa sürükle
5. Transfer modu **Binary** olsun (Transfer → Transfer Type → Binary); Auto/ASCII modunda
   `data.json` bozulabilir. Üzerine yazma diyalogunda **Overwrite** + "Always use this action"

Neyin değiştiğine göre kısayol:

| Değişen | Yüklenecek |
|---|---|
| Sadece tarama verisi | `dist/data/data.json` |
| Yeni rapor ürettin | `dist/data/data.json` **ve** `dist/data/raporlar/` |
| Panel kodu/tasarımı | `dist/index.html` **ve** `dist/assets/` birlikte |
| Emin değilsen | `dist/` içindekilerin hepsi (~460 KB) |

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
