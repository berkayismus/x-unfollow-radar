# X Unfollow Radar - Mimari Doküman (TR)

Bu dokümanda X Unfollow Radar Chrome eklentisinin yüksek seviye mimarisi, ana bileşenleri ve aralarındaki veri akışı anlatılmaktadır.

## 1. Genel Bakış

- **Amaç**: Twitter/X üzerinde seni takip etmeyen hesapları taramak ve kullanıcı tarafından başlatılan çalışmada kontrollü biçimde takipten çıkarmak.
- **Teknolojiler**:
    - Chrome Extension Manifest V3
    - Vanilla JavaScript (framework yok)
    - Chrome Storage API
    - Chrome Messaging API
    - Chartist.js (istatistik grafikleri)

Eklenti üç ana parçaya ayrılır:

1. `content script` → Twitter/X sayfasında çalışan otomasyon motoru
2. `popup` → Kullanıcı arayüzü (başlat/durdur, filtreler, istatistikler)
3. `background service worker` → Mesaj relay ve durum güncellemeleri

## 2. Dosya Yapısı (Özet)

- `manifest.json`  
  Eklentinin manifest dosyası; izinler, content script, background ve popup tanımları burada.

- `src/content/index.js`  
  Asıl iş yükü burada:
    - Sayfadaki kullanıcı kartlarını (`USER_CELL_MAIN`) tarar.
    - \"Follows you\" badge'i olmayanları filtrelerden geçirip işlem kuyruğuna ekler.
    - Whitelist ve keyword filtrelerini uygular.
    - Kuyruktaki hesaplar için \"Following\" ve hedef kullanıcıya ait X onay butonunu kullanır.
    - X'in görünür toast, alert ve dialog metinlerinden rate-limit sinyallerini algılar; bekleme/devam durumunu saklar.

- `src/popup/popup.html / popup.js / popup.css`  
  3 sekmeli (Main / Filters / Statistics) popup arayüzü:
    - Ana sekme: başlat/durdur, dry-run, yakın tarihli profili açma, anlık kullanıcı listesi.
    - Filtreler sekmesi: keyword filter ve whitelist yönetimi.
    - İstatistikler sekmesi: Son 30 gün grafiği ve CSV export.

- `src/background/index.js`  
  Content script → Popup mesajlarını relay eder, Gumroad lisans doğrulamasını yürütür ve storage migration'ını başlatır.

- `src/shared/constants.js`  
  Zamanlama, limitler, selector'lar, metin pattern'leri, storage key'leri ve mesaj tipleri gibi merkezi sabit değerleri içerir.

- `src/shared/i18n.js` + `locales/*.json`  
  Çoklu dil desteği (TR/EN/DE).
  `i18n.js` tarayıcı diline ve kayıtlı kullanıcı tercihine göre locale belirler, ilgili JSON'dan metinleri yükler ve `data-i18n` attribute'larına uygular.

## 3. Bileşenler Arası Veri Akışı

### 3.1. Popup → Content Script

- Kullanıcı **Takipten çıkarmayı başlat**'a bastığında popup `START` gönderir.
- Content script görünür hesapları tarar ve uygun olanları aynı çalışma içinde işlem kuyruğuna alır.

- **Durdur**, **Devam Et (50 kişi daha)**, **Dry-run toggle** ve filtre güncellemeleri de benzer şekilde `chrome.tabs.sendMessage` ile content script'e iletilir.

### 3.2. Content Script → Popup

Content script, çalışma sırasında popup'a iki kanal üzerinden bilgi gönderir:

1. **Durum güncellemeleri** (`STATUS_UPDATE`):
    - `sendStatus(status, data)` fonksiyonu ile `chrome.runtime.sendMessage` kullanılır.
    - Örnek: `STATUS.SCANNING`, `STATUS.UNFOLLOWED`, `STATUS.LIMIT_REACHED` gibi.

2. **Kullanıcı ve çalışma güncellemeleri** (`USER_PROCESSED`, `RUN_STATE_UPDATED`):
    - Gerçek/dry-run işlemleri kullanıcı güncellemesi olarak; atlanan ve başarısız kayıtlar kalıcı çalışma durumu üzerinden gönderilir.
    - Popup, bu bilgiyi kullanarak \"Processed Users\" listesini günceller.

Background service worker ( `src/background/index.js` ) bu mesajları dinler ve doğrudan popup'a relay eder. Böylece content script ile popup arasında gevşek bağlı (loosely coupled) bir iletişim katmanı oluşur.

## 4. İş Akışı (Main Loop)

`mainLoop()` fonksiyonu içeride şu sırayla çalışır:

1. `initStorage()`
    - Son 24 saatteki gerçek işlem zamanlarını, son çalışma durumunu, toplam takipten çıkma, keyword'ler, whitelist ve dry-run modu gibi değerleri `chrome.storage.local` üzerinden okur.
    - `schemaVersion` tabanlı idempotent migration katmanı eski sayaç verilerini yeni aksiyon zamanı şemasına güvenle taşır.
    - Her uygun hesap için `queued → attempting → succeeded/failed` geçişlerini saklar; atlananları ayrı sonuç olarak tutar.
    - Her gerçek işlemi kendi zamanından 24 saat sonra güvenlik sayacından çıkarır.

2. Tarama ve kuyruk oluşturma:
    - `scanUsers()` ile ekrandaki kullanıcı kartlarını tarar.
    - \"Follows you\" badge'i olmayanları whitelist/keyword kontrolünden geçirip `unfollowQueue`'ya ekler.

3. Aynı çalışma içindeki yürütme aşamasında:
    - Kuyruktaki her kullanıcı için `unfollowUser()` çağrılır:
        - Dry-run ise sadece simüle eder ve istatistikleri günceller.
        - Normal modda \"Following\" butonu + onay butonu tıklanır; istatistikler, geçmiş ve son profiller kuyruğu güncellenir.
    - Sayfanın sonuna gelindiğinde çalışma tamamlanır.
    - Rate limit veya 24 saatlik limit dolduğunda uygun STATUS değerleri gönderilir ve döngü sonlandırılır / duraklatılır.

## 5. Rate Limit ve Güvenlik

- **Rate Limit**: X arayüzündeki bilinen toast, alert veya dialog sinyalleri algılandığında:
    - `handleRateLimit()` fonksiyonu `RATE_LIMIT_HIT` mesajı yollar, bekleme süresini (`RATE_LIMIT_WAIT`) hesaplar ve `isPaused = true` yapar.
    - Popup, kalan süreyi bir geri sayım olarak gösterir.

- **Dry-Run Mode**:
    - Gerçekte takipten çıkarma yapmadan bütün akışı simüle eder (istatistikler ve kullanıcı listesi dahil).

- **Yakın Tarihli Profiller**:
    - Her gerçek unfollow için son 10 kullanıcı bilgisi yerel kuyruğa eklenir.
    - Popup profili yeni sekmede açar; yeniden takip işlemi kullanıcı tarafından manuel yapılır.

## 6. Temalar ve Erişilebilirlik

- **Tema Yönetimi**:
    - `Constants.THEMES` (`light`, `dark`) ve `STORAGE_KEYS.THEME` kullanılarak kullanıcı seçimi kaydedilir.
    - Popup açıldığında kayıtlı tema yüklenir ve `document.documentElement.classList` üzerinden uygulanır.

- **Erişilebilirlik (A11y)**:
    - Tüm kritik buton ve kontrollerde `aria-label`, `role`, `aria-live` gibi attribute'lar kullanılır.
    - Klavye gezinmesi için tab yapısı ve `handleTabKeyboard` fonksiyonu ile ok tuşları desteği sağlanır.

## 7. Uluslararasılaştırma (i18n)

- Desteklenen diller: `tr`, `en`, `de`.
- Açılışta:
    1. Daha önce kaydedilmiş dil tercihi varsa (`chrome.storage.local['language']`), o kullanılır.
    2. Yoksa `navigator.language`'e bakılır:
        - `tr-*` ise Türkçe
        - `de-*` ise Almanca
        - Diğer tüm durumlarda İngilizce
    3. Seçilen dil storage'a yazılır ve popup boyunca sabit kalır.
- Dil değişimi:
    - Popup header'daki dropdown ile TR/EN/DE arasında geçiş yapılır.
    - `I18n.setLocale(locale)` çağrısı `locales/{locale}.json` dosyasını yükler ve `data-i18n` alanlarını yeniden uygular.
