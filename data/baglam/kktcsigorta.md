# KKTC Sigorta Merkezi — proje baglami
<!-- https://kktcsigortamerkezi.com · son guncelleme: 2026-08-24 -->

## Ne is yapiyor

Kuzey Kibris'taki hayat disi sigorta sirketlerini bagimsiz olarak degerlendiren
bilgi sitesi. Sirket satmiyor, police satmiyor, komisyon almiyor, teklif formu
yok. Gelir modeli iceriktir. KKSRSB (KKTC Sigorta ve Reasurans Sirketleri
Birligi) uyesi 39 ruhsatli sirketi alti olcutte puanliyor ve her puanin
kaynagini gosteriyor.

Statik site: `content/` + Jinja sablonlari -> `dist/`. Calisma aninda sablon
motoru, veritabani ya da JS bagimliligi yok. Uretici `_build/uret.py`,
yayin komutu `./yayinla.sh`.

## Hedef kitle

Kuzey Kibris'ta police alacak ya da hasar surecine girmis kisiler:
- KKTC vatandaslari ve yerlesikler (TR)
- Ada'daki ogrenciler ve yabancilar (EN/RU/FA planlanmis)
- Turkiye'den gelip KKTC mevzuatini Turkiye sanan kullanicilar

Arama niyeti bilgi arayisi agirlikli: "nedir", "nasil yapilir", "hangi sirket",
"KKTC'de ... Turkiye'den farki ne".

## Bu donemki hedef

5 Agustos 2026'da `noindex` kapatildi, site aramaya acildi. Su anki oncelik
indekslenme ve ilk organik gorunurluk. Icerik tarafinda oncelik: sirket bazli
sorgular ("<sirket adi> <sehir>") ve ayrim yazilari (KKTC vs Turkiye).

## Konumlandirma / fark

Ayirt edici yan **dogrulanabilirlik ve kapsam durustlugu**:

1. **Sirket / acente ayrimi.** Internetteki "KKTC sigorta sirketleri"
   listelerinin cogu acenteleri sirket gibi siraliyor. Bu site yalnizca KKSRSB
   uye listesindeki ruhsatli sirketleri degerlendiriyor.
2. **KKTC ≠ Turkiye.** Turkiye mevzuatini KKTC'ye tasimak sektorde yaygin hata.
   Ornek: Turkiye'de zorunlu trafikte **tavan** prim vardir, KKTC'de **taban**
   tarife — zit yonde iki sinir.
3. **Olcemedigini soylemek.** Mali guc ve hasar odeme performansi KKTC'de
   sirket bazinda kamuya acik yayimlanmadigi icin **puanlanmiyor** ve bu her
   sayfada yaziliyor.

## Rakipler

- Sigorta acentelerinin kendi blog sayfalari — teklif toplamak icin yaziyorlar,
  bagimsiz degiller.
- Turkiye kaynakli genel sigorta portallari — KKTC'yi Turkiye mevzuatiyla
  anlatiyorlar; asil ayristigimiz yer burasi.
- Sirketlerin kendi kurumsal siteleri — karsilastirma yapmiyorlar.

## Onemli sayfalar

- `/tr/sirketler/` — 39 sirketin puanli listesi. Sitenin cekirdegi.
- `/tr/sirketler/<slug>/` — sirket profilleri (39 adet). Marka sorgularinin inis sayfasi.
- `/tr/metodoloji/` — alti olcutun tanimi ve agirliklari. Guvenin dayandigi sayfa;
  puan gecen her yazidan buraya link verilir.
- `/tr/sigorta/<brans>/` — trafik, kasko, saglik, konut, seyahat, isyeri.
- `/tr/rehber/` — yazilar. Kategoriler otomatik konu sayfasi uretir.
- `/tr/duzeltme/` — duzeltme talebi. Dogrulayamadigimiz her sey buraya baglanir.

## Puanlama olcutleri ve agirliklari

| Olcut | Agirlik |
|---|---|
| Seffaflik ve dogrulanabilirlik | %25 |
| Urun ve teminat genisligi | %20 |
| Erisilebilirlik | %20 |
| Dijital hizmet | %20 |
| Dil destegi | %10 |
| Kurumsal gecmis | %5 |

Puanlanmayan iki olcut: **mali guc** ve **hasar odeme performansi** — veri
kamuya acik degil. Puan araligi 0,0–10,0. Guncelleme yilda iki kez.
Kaynak veri: `data/sirketler.json` (arastirma tarihi 22 Temmuz 2026),
ham derleme: `data/arastirma-kktc-sigorta.md`.

## Yazim tercihleri

**Ton:** sakin, olgusal, satis dili yok. Abartisiz. Okuru yonlendirmez, bilgilendirir.

**Mutlak kural — dogrulayamadigin rakami yazma.** Bos birak ve neden bos
oldugunu soyle. Yazilarin cogunda `## Dogrulayamadiklarimiz` bolumu var ve bu
bolum sitenin imzasidir; cikarilmaz.

**Kacinilan ifadeler:**
- "bu yazimizda", "gelin birlikte bakalim" gibi isinma cumleleri
- "en iyi", "en ucuz", "lider", "guvenilir" gibi dayanaksiz sifatlar
- Turkiye mevzuatindan tasima terimler (tavan prim, SBM, Tahkim Komisyonu'nun
  TR surumu) — KKTC karsiligi ayrica dogrulanmadan kullanilmaz
- Prim/fiyat rakami — hicbir sayfada yazilmaz

**Terminoloji:** "zorunlu trafik" (kasko degil), "brans", "taban tarife",
"KKSRSB", "KKSBM". Sirket adlari `data/sirketler.json`'daki tam unvanla.

**Yapi:** H2/H3 basliklar, tablolar, `## Kaynaklar` bolumu (her kaynak
"<tarih>'te goruldu" notuyla). FAQPage semasi elle eklenir — BlogPosting
otomatik uretildigi icin tekrar yazilmaz.

**Ic link kurali:** yalnizca gercekten uretilmis sayfalara link verilir.
Kontrol: `dist/<yol>/index.html` dosyasi var mi. Puan gecen her yazi
`/tr/metodoloji/` sayfasina link verir.

## Notlar / gecmis kararlar

- **2026-07-22** — Sirket verisi toplandi (39 sirket, `data/sirketler.json`).
  Her alan tek tek elle kontrol edildi, kaynak URL'siyle kaydedildi.
- **2026-08-05** — `site.json` -> `yayin.noindex` **false** yapildi; site
  aramaya acildi. Ayni gun taban tarife rehberi yayimlandi.
- **Mali guc puanlanmayacak.** 2019–2026 arasi hicbir kamu kaynaginda sirket
  bazinda prim/hasar/ozkaynak verisi bulunamadi. Tahmin uretmek yerine olcutu
  puanlama disi birakma karari alindi; metodoloji sayfasinda aciklanmis durumda.
- **Tahkim karar frekansi kullanilmayacak.** KKSRSB Yuksek Mahkeme kararlarinda
  sistematik indeks yok; frekans saymak yaniltici olurdu.
- **Tasarim yonu:** iki yuzey (beyaz + `--paper`), tek eylem rengi (`--accent`),
  tek uyari rengi (`--flag`). Yeni renk eklenmiyor. Koyu bantli editoryal yon
  degerlendirildi ve reddedildi.
- **Diller:** yapi tr/en/ru/fa destekliyor, su an yalnizca **TR** uretiliyor.
  `content/en/...` doldurulunca dil degistirici ve hreflang kendiliginden belirir.
- **2026-08-24** — `copy/03-marka-sorgulari.md` yazildi: 39 sirketin marka
  sorgulari icin tam plan. Yayin sirasi: IP-2 (K1 bes sirket) -> IP-1 (profil
  derinlestirme) -> sema duzeltmesi -> Set H -> Set I. **IP-1 yayimlanmadan
  Set H ve Set I yayimlanmaz.**
- **2026-08-24** — "can sigorta lefkosa" rehber yazisi uretildi ama
  **taslakta birakildi** (`content/tr/rehber/can-sigorta-lefkosa.md`).
  Gerekce: §8 "marka x sehir" sayfalarini uretilmeyecekler listesine almis;
  profil sayfasinin "Nereden ulasiliyor" bolumu ayni sorguyu karsiliyor ve
  `/tr/sirketler/can-sigorta/` ile kanibalizasyon dogar. Panel surumu
  (`data/icerikler/kktcsigorta-can-sigorta-lefkosa.md`) duruyor.

## Plan dosyalari — yazmadan ONCE okunacaklar

`copy/` altindaki bu dort dosya sitenin karar kaydidir. Yeni sayfa uretmeden once
ilgili olanlar okunur; bunlara aykiri sayfa uretilmez.

| Dosya | Ne belirler |
|---|---|
| `copy/00-brief.md` | **⛔ ASLA YAZILMAYACAKLAR tablosu** ve ⚠ etiketlenmesi sart olanlar |
| `copy/01-icerik-stratejisi.md` | Icerik sutunlari (P1–P5) |
| `copy/02-programatik-seo.md` | Set A vd. programatik sayfa setleri |
| `copy/03-marka-sorgulari.md` | Marka sorgulari plani, **§8 uretilmeyecekler**, yayin sirasi |
| `copy/yayin-kuyrugu.md` | Siradaki yazilar. Yeni yazi buradan secilir; mevcut sira bozulmaz |
| `copy/url-haritasi.md` | Tum adres yapisi |

### ⛔ Uretilmeyecek sayfa tipleri (`03-marka-sorgulari.md` §8)

- **Marka x brans** (`/tr/sirketler/<sirket>/trafik/`) — 468 sayfa. Profil
  sayfasindaki cipali bolum karsiliyor.
- **Marka x sehir** (`can sigorta lefkosa`, `dagli sigorta girne`) — 195 sayfa.
  Profilin "Nereden ulasiliyor" bolumu karsiliyor.
- **Yorum/puan sayfalari** — elimizde dogrulanmis musteri deneyimi yok.
  `AggregateRating` semasi, yildiz, kullanici yorumu hicbir sayfada olmaz.
- Ayrisma kurali disindaki karsilastirma ciftleri.

Gerekce ortak: tek guclu sayfa, cok sayida ince sayfayi yener. Marka sorgusunu
kazandiran sey guvenilirliktir, anahtar kelime yerlesimi degil.

### Rehber kuyrugundaki onayli marka yazilari

M1–M8 (`03-marka-sorgulari.md` §10). Marka konulu yeni bir rehber yazisi
isteniyorsa once bu listeden secilir — hepsi hub niteliginde ve profil
sayfalariyla catismiyor.

## Ajanlar icin kisa checklist

1. `copy/00-brief.md` ⛔ tablosunu oku — aykiri tek cumle yayimlanmaz.
2. Uretecegin sayfa tipi §8'de yasakli mi, kontrol et.
3. `data/sirketler.json`'dan olguyu dogrula — uydurma.
4. Ic linkleri `dist/` altinda var mi diye kontrol et.
5. Prim/fiyat rakami yazma.
6. Turkiye mevzuatini KKTC'ye tasima.
7. `## Dogrulayamadiklarimiz` ve `## Kaynaklar` bolumlerini ekle.
8. Puan gectiyse `/tr/metodoloji/` linki ver.
