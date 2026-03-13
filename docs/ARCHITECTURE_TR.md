# X Unfollow Radar - Mimari Doküman (TR)

Bu dokümanda X Unfollow Radar Chrome eklentisinin yüksek seviye mimarisi, ana bileşenleri ve aralarındaki veri akışı anlatılmaktadır.

## 1. Genel Bakış

- **Amaç**: Twitter/X üzerinde seni takip etmeyen kullanıcıları tespit edip otomatik olarak takipten çıkmak.
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
  - \"Follows you\" badge'i olmayanları kuyruklar.
  - Whitelist ve keyword filtrelerini uygular.
  - \"Following\" butonuna tıklayıp çıkan onay penceresinden takipten çıkarma işlemini yapar.
  - Rate limit durumunu tespit eder ve bekleme mantığını yönetir.

- `src/popup/popup.html / popup.js / popup.css`  
  3 sekmeli (Main / Filters / Statistics) popup arayüzü:
  - Ana sekme: başlat/durdur, dry-run, undo, anlık kullanıcı listesi.
  - Filtreler sekmesi: keyword filter ve whitelist yönetimi.
  - İstatistikler sekmesi: Son 30 gün grafiği ve CSV export.

- `src/background/index.js`  
  Content script → Popup arasındaki mesajları relay eder (özellikle status update, rate limit, test complete olayları).

- `src/shared/constants.js`  
  Zamanlama, limitler, selector'lar, metin pattern'leri, storage key'leri ve mesaj tipleri gibi merkezi sabit değerleri içerir.

- `src/shared/i18n.js` + `locales/*.json`  
  Çoklu dil desteği (TR/EN).  
  `i18n.js` tarayıcı diline ve kayıtlı kullanıcı tercihine göre locale belirler, ilgili JSON'dan metinleri yükler ve `data-i18n` attribute'larına uygular.

## 3. Bileşenler Arası Veri Akışı

### 3.1. Popup → Content Script

- Kullanıcı popup'tan **Başlat**'a bastığında:
  - `popup.js` → `chrome.tabs.sendMessage(..., { action: Constants.ACTIONS.START })`
  - `content/index.js` içindeki message listener bu mesajı yakalar, `isRunning = true` yapar ve `mainLoop()` fonksiyonunu tetikler.

- **Durdur**, **Devam Et (50 kişi daha)**, **Dry-run toggle**, **Undo** ve filtre güncellemeleri de benzer şekilde `chrome.tabs.sendMessage` ile content script'e iletilir.

### 3.2. Content Script → Popup

Content script, çalışma sırasında popup'a iki kanal üzerinden bilgi gönderir:

1. **Durum güncellemeleri** (`STATUS_UPDATE`):
   - `sendStatus(status, data)` fonksiyonu ile `chrome.runtime.sendMessage` kullanılır.
   - Örnek: `STATUS.SCANNING`, `STATUS.UNFOLLOWED`, `STATUS.LIMIT_REACHED` gibi.

2. **Kullanıcı işlendi** (`USER_PROCESSED`):
   - Her kullanıcı için `USER_ACTIONS` (unfollowed, dry-run, skipped) bilgisi ve zaman damgası gönderilir.
   - Popup, bu bilgiyi kullanarak \"Processed Users\" listesini günceller.

Background service worker ( `src/background/index.js` ) bu mesajları dinler ve doğrudan popup'a relay eder. Böylece content script ile popup arasında gevşek bağlı (loosely coupled) bir iletişim katmanı oluşur.

## 4. İş Akışı (Main Loop)

`mainLoop()` fonksiyonu içeride şu sırayla çalışır:

1. `initStorage()`  
   - Güncel session sayacı, toplam takipten çıkma, keyword'ler, whitelist ve dry-run modu gibi değerleri `chrome.storage.local` üzerinden okur.
   - 24 saatlik oturum süresi aşılmışsa session sayacını sıfırlar.

2. Sonsuz döngü içinde:
   - `scanUsers()` ile ekrandaki kullanıcı kartlarını tarar.
   - \"Follows you\" badge'i olmayanları, whitelist/keyword kontrolünden geçirip `unfollowQueue`'ya ekler.
   - Kuyruktaki her kullanıcı için `unfollowUser()` çağrılır:
     - Dry-run ise sadece simüle eder ve istatistikleri günceller.
     - Normal modda \"Following\" butonu + onay butonu tıklanır, istatistikler ve undo kuyruğu güncellenir.
   - Kullanıcılar tükendiğinde `autoScroll()` ile sayfa aşağıya kaydırılır, yeni kullanıcılar yüklenir ve süreç devam eder.
   - Rate limit veya 24 saatlik limit dolduğunda uygun STATUS değerleri gönderilir ve döngü sonlandırılır / duraklatılır.

## 5. Rate Limit ve Güvenlik

- **Rate Limit**: HTTP 429 veya ilgili hatalar yakalandığında:
  - `handleRateLimit()` fonksiyonu `RATE_LIMIT_HIT` mesajı yollar, bekleme süresini (`RATE_LIMIT_WAIT`) hesaplar ve `isPaused = true` yapar.
  - Popup, kalan süreyi bir geri sayım olarak gösterir.

- **Dry-Run Mode**:
  - Gerçekte takipten çıkarma yapmadan bütün akışı simüle eder (istatistikler ve kullanıcı listesi dahil).

- **Undo Sistemi**:
  - Her gerçek unfollow için `undoQueue`'ya kullanıcı bilgisi eklenir.
  - Popup'tan gelen `UNDO_LAST` veya `UNDO_SINGLE` aksiyonlarıyla, kullanıcıya profil üzerinden yeniden follow işlemini kolaylaştıran yönlendirme yapılır.

## 6. Temalar ve Erişilebilirlik

- **Tema Yönetimi**:
  - `Constants.THEMES` (`light`, `dark`) ve `STORAGE_KEYS.THEME` kullanılarak kullanıcı seçimi kaydedilir.
  - Popup açıldığında kayıtlı tema yüklenir ve `document.documentElement.classList` üzerinden uygulanır.

- **Erişilebilirlik (A11y)**:
  - Tüm kritik buton ve kontrollerde `aria-label`, `role`, `aria-live` gibi attribute'lar kullanılır.
  - Klavye gezinmesi için tab yapısı ve `handleTabKeyboard` fonksiyonu ile ok tuşları desteği sağlanır.

## 7. Uluslararasılaştırma (i18n)

- Desteklenen diller: `tr`, `en`.
- Açılışta:
  1. Daha önce kaydedilmiş dil tercihi varsa (`chrome.storage.local['language']`), o kullanılır.
  2. Yoksa `navigator.language`'e bakılır:
     - `tr-*` ise Türkçe
     - Diğer tüm durumlarda İngilizce
  3. Seçilen dil storage'a yazılır ve popup boyunca sabit kalır.
- Dil değişimi:
  - Popup header'daki dropdown ile TR/EN arasında geçiş yapılır.
  - `I18n.setLocale(locale)` çağrısı `locales/{locale}.json` dosyasını yükler ve `data-i18n` alanlarını yeniden uygular.

