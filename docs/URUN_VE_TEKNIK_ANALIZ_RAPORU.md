# X Unfollow Radar - Güncel Ürün ve Teknik Durum Raporu

- **İlk inceleme:** 2 Ağustos 2026
- **Durum güncellemesi:** 29 Ağustos 2026
- **Sürüm:** `2.0.3`
- **Kapsam:** Manifest, content script, popup, background service worker, yerel veri modeli, lisanslama, i18n, gizlilik, test ve mağaza dokümanları

## 1. Yönetici özeti

İlk incelemede tespit edilen doğruluk, gizlilik, otomasyon dayanıklılığı ve bakım altyapısı sorunları Faz 1-3 kapsamında ele alındı. Güncel ürün, kullanıcı başlattığında tarama ve kontrollü takipten çıkarma işlemlerini aynı çalışma içinde yürütür.

Planlanan geliştirme kapsamı Faz 1-3 ile tamamlanmıştır. Bu rapor güncel uygulama durumunu açıklar; ilk incelemedeki eski satır numaraları ve artık geçerli olmayan hata tarifleri kaldırılmıştır.

## 2. Güncel ürün davranışı

- X/Twitter Following sayfasındaki ana sütunda görünen `UserCell` kartlarını tarar.
- Görünür “Follows you” metni bulunmayan ve filtrelere takılmayan hesapları işlem kuyruğuna ekler.
- İşlem öncesinde hedef kullanıcıya ait dialog'u doğrular ve buton durumundan sonucu kontrol eder.
- Free plan için 50, Pro plan için 500 gerçek işlemden oluşan kayan 24 saat güvenlik penceresi uygular.
- Pro planda ilk 50 gerçek işlemden sonra ek devam onayı ister.
- Dry-run sonuçlarını gerçek işlemlerden ve güvenlik sayacından ayırır.
- Gerçek, dry-run, atlanan ve başarısız kayıtları kalıcı son çalışma özetinde ayrı tutar.
- Whitelist, keyword filtresi, 30 günlük geçmiş, CSV export, tema ve TR/EN/DE popup arayüzü sağlar.
- Otomatik geri takip yapmaz; son profilleri kullanıcının manuel değerlendirmesi için açar.

## 3. Tamamlanan ilk inceleme bulguları

| İlk bulgu                                         | Güncel durum                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Pro limitinin motor tarafından uygulanmaması      | Popup ve content script ortak `getSessionLimit()` kaynağını kullanıyor.                          |
| “Undo” davranışının yanıltıcı olması              | Özellik profil açma ve manuel takip davranışı olarak açıkça adlandırıldı.                        |
| Gizlilik politikasının kodla çelişmesi            | Yerel X verileri, saklama süreleri ve Gumroad lisans aktarımı açıklandı.                         |
| Rate-limit durumunun yenilemeden sonra kaybolması | Timestamp tabanlı bekleme saklanıyor, yenilemede yeniden uygulanıyor ve zamanlanıyor.            |
| Scroll bitişinin DOM kart sayısına bağlı olması   | Benzersiz kullanıcı büyümesi ve `MutationObserver` beklemesi kullanılıyor.                       |
| Popup sekmelerinin `hidden` kalması               | Class ve `hidden` durumu birlikte yönetiliyor; Playwright ile doğrulanıyor.                      |
| Kontrolsüz toplu işlem riski                      | Kullanıcı başlatması, dry-run, filtreler, kayan limit ve batch devam onayı birlikte uygulanıyor. |
| Stop işleminin gecikmeleri iptal edememesi        | Aktif zincir `AbortController` ile iptal ediliyor.                                               |
| Başarının yalnızca tıklama üzerinden varsayılması | Dialog hedefi ve işlem sonrası buton durumu doğrulanıyor.                                        |
| Dry-run'ın gerçek sayaçları kirletmesi            | Dry-run ayrı istatistik ve çalışma sonucu olarak tutuluyor.                                      |
| Son çalışmanın popup kapanınca kaybolması         | Sınırlı ve kalıcı run-state modeli popup açılışında geri yükleniyor.                             |
| CSV escaping ve formül enjeksiyonu riski          | Alan kaçışları ve spreadsheet formül koruması eklendi.                                           |
| Lisansın yalnızca aktivasyonda doğrulanması       | Gumroad entitlement periyodik doğrulaması ve çevrimdışı grace durumu eklendi.                    |
| Storage şemasının sürümsüz olması                 | `schemaVersion: 2` ve idempotent migration altyapısı eklendi.                                    |
| Test, lint ve CI eksikliği                        | ESLint, Prettier, unit/smoke, DOM fixture, Playwright ve GitHub Actions kontrolleri eklendi.     |
| Dosya sürümlerinin ayrışması                      | `npm run release` ve `release:check` ile manifest/package/lock senkronizasyonu sağlandı.         |

## 4. Veri ve gizlilik modeli

Uygulama X hesap yönetimi verilerini `chrome.storage.local` içinde tutar. Buna kullanıcı adları, filtreler, whitelist, geçmiş, son çalışma durumu, güvenlik zaman damgaları ve tercihler dahildir.

Geliştirici tarafından işletilen bir backend, analitik veya telemetri bulunmaz. Pro lisans anahtarı aktivasyon ve periyodik yeniden doğrulama sırasında doğrudan Gumroad API'sine gönderilir. X kullanıcı adları, Following listesi, filtreler ve X oturum bilgileri Gumroad'a gönderilmez.

Popup iki farklı silme kontrolü sunar:

1. İstatistik sıfırlama; geçmiş ve çalışma istatistiklerini temizler fakat aktif güvenlik penceresini, filtreleri ve lisansı korur.
2. Tüm yerel verileri silme; extension'a ait `chrome.storage.local` içeriğini temizler.

Ayrıntılı ve kullanıcıya yönelik beyanın tek kaynağı `PRIVACY_POLICY.md` dosyasıdır.

## 5. Test ve release durumu

Her push ve pull request'te şu kontroller GitHub Actions üzerinde çalışır:

- ESLint
- Prettier format kontrolü
- JavaScript sözdizimi testleri
- Limit, locale, CSV, run-state, migration ve Gumroad regresyon testleri
- JSDOM tabanlı `UserCell` fixture testleri
- Gerçek Chromium ile unpacked-extension popup smoke testi
- Manifest ve runtime dosya bütünlüğü kontrolü
- `package.json`, `package-lock.json` ve `manifest.json` sürüm eşitliği

Yerel doğrulama komutları:

```bash
npm ci
npm run lint
npm test
npm run test:e2e
npm run package:check
npm run release:check
```

## 6. Bilinen teknik sınırlar

- Takip etmeyen hesap tespiti X'in görünür DOM'una ve “Follows you” metnine bağlıdır. X arayüz değişiklikleri selector veya pattern güncellemesi gerektirebilir.
- “Follows you” ve “Following” algılama desenleri İngilizce ve Türkçe X arayüz metinlerini kapsar; popup'ın Almanca olması, Almanca X DOM metinlerinin tamamının algılandığı anlamına gelmez.
- Rate-limit tespiti X'in görünür toast/alert/dialog sinyallerine dayanır. Kontrollü tempo ve bekleme mekanizması hesap kısıtlaması olmayacağını garanti etmez.
- Lisans istemci tarafında saklanır. Periyodik Gumroad doğrulaması manipülasyon riskini azaltır ancak istemci tarafı lisanslamayı mutlak güvenli hale getirmez.
- Yapılandırılmış ve dışa aktarılabilir bir tanı raporu bulunmaz; hata ayrıntıları ağırlıklı olarak console ve son çalışma özetindedir.

## 7. Yayın hazırlığı

Kod tarafındaki Faz 1-3 kapsamı tamamlanmıştır. Chrome Web Store gönderimi için kalan işler geliştirici hesabı, destek e-postası, Dashboard privacy/single-purpose beyanları, temiz ZIP yükleme ve incelemeye gönderme gibi harici yayın adımlarıdır.

Güncel kontrol listesi `docs/CHROME_WEB_STORE_PLAN.md`, uygulama adımları ise `docs/CHROME_WEB_STORE_UPLOAD.md` içinde tutulur.

## 8. Sonuç

X Unfollow Radar güncel durumda kullanıcı tarafından başlatılan tek-adımlı tarama ve kontrollü takipten çıkarma akışına sahip bir Chrome eklentisidir. Dry-run, filtreler, kayan 24 saat limiti ve Pro batch devam onayı korunur. Faz 1-3 kapsamındaki doğruluk ve bakım işleri tamamlanmıştır.
