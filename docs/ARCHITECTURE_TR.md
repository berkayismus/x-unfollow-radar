# Mimari (TR)

X Unfollow Radar, Chrome Manifest V3 kullanan framework'süz bir eklentidir.

## Bileşenler

| Bileşen                   | Sorumluluk                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `src/content/index.js`    | X Following sayfasını tarar, filtreler ve işlemleri yürütür                         |
| `src/popup/`              | Başlat/durdur, Önizleme modu, filtreler, sayaçlar ve grafik                         |
| `src/background/index.js` | Gumroad lisans doğrulaması ve storage migration başlangıcı                          |
| `src/shared/`             | Sabitler, migration, DOM, tespit, güvenlik penceresi ve çalışma durumu yardımcıları |
| `locales/`                | Türkçe, İngilizce ve Almanca popup metinleri                                        |

Background worker durum mesajlarını yeniden iletmez. Content script popup'a doğrudan mesaj gönderir; bu, yinelenen kullanıcı kayıtlarını önlemeye yardımcı olur.

## İşlem akışı

1. Popup aktif sekmeye `START` gönderir.
2. Content script storage migration'ını çalıştırır ve kayıtlı ayarları yükler.
3. Ana sütundaki `UserCell` kartlarını tarar.
4. “Follows you / Seni takip ediyor” bilgisi olan, whitelist'teki veya keyword filtresine takılan hesapları atlar.
5. Kalan hesapları `queued → attempting → succeeded/failed` durumlarıyla işler.
6. Gerçek modda hedef X onay penceresini doğrular ve onay düğmesini otomatik tıklar.
7. Kuyruk bittiğinde yeni kartlar için sayfayı kaydırır; yeni kullanıcı kalmayınca tamamlanır.

`STOP`, `TOGGLE_DRY_RUN`, `UPDATE_KEYWORDS` ve `UPDATE_WHITELIST` mesajları popup'tan content script'e gider. `STATUS_UPDATE`, `USER_PROCESSED` ve `RUN_STATE_UPDATED` mesajları ters yönde gider.

## Güvenlik davranışı

- Gerçek işlemler arasında 2–5 saniye rastgele gecikme vardır.
- Free limit 50, Pro limit 500 gerçek işlem/24 saattir.
- Her gerçek işlem kendi zamanından 24 saat sonra güvenlik sayacından çıkar.
- Reset istatistikleri temizler fakat aktif gerçek işlem güvenlik penceresini korur.
- Stop, aktif bekleme ve tıklama zincirini `AbortController` ile keser.
- Üç ardışık doğrulanamayan işlem circuit breaker'ı tetikler.
- Görünür rate-limit sinyali 15 dakikalık kayıtlı bekleme başlatır.

Bu önlemler hesap kısıtlaması yaşanmayacağını garanti etmez.

## Önizleme modu

Arayüzde **Önizleme modu**, kod ve storage içinde `dryRun` olarak adlandırılır.

- Hesaplar aynı filtre ve tarama akışından geçer.
- X üzerinde takipten çıkarma yapılmaz.
- Son 24 saat ve toplam önizleme sayaçları ayrı tutulur.
- Gerçek güvenlik kotası tüketilmez.

## Yerel veri

`chrome.storage.local` içinde başlıca şu veriler saklanır:

- Gerçek ve önizleme zaman damgaları ile toplamlar
- Son çalışma durumu ve sınırlı kullanıcı kayıtları
- 30 günlük gerçek işlem geçmişi ve son 10 profil
- Whitelist, keyword, tema, dil ve Önizleme tercihi
- Rate-limit zamanı, plan ve Gumroad lisans bilgileri
- `schemaVersion: 4`

İstatistik sıfırlama ile tüm yerel verileri silme ayrı işlemlerdir. Ayrıntılar [../PRIVACY_POLICY.md](../PRIVACY_POLICY.md) dosyasındadır.

## Lisans

Popup `VERIFY_LICENSE` ve `GET_PLAN` mesajlarını background worker'a gönderir. Worker lisans anahtarını Gumroad'a `product_id` ile doğrular. Son doğrulamanın üzerinden 24 saat geçmişse bir sonraki plan sorgusunda yeniden doğrulama yapılır; ağ hatalarında en fazla 7 günlük çevrimdışı grace uygulanır.

## Testler

- Syntax, smoke ve unit testleri
- UserCell DOM fixture testleri
- Playwright unpacked-extension testi
- ESLint, Prettier, paket ve sürüm kontrolleri

GitHub Actions aynı kontrolleri push ve pull request'lerde çalıştırır.
