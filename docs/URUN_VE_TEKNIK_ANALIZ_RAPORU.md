# Ürün ve Teknik Durum

**Sürüm:** `2.0.3` · **Güncelleme:** 29 Ağustos 2026

## Ürün davranışı

- X/Twitter Following sayfasındaki ana kullanıcı kartlarını tarar.
- Görünür “Follows you / Seni takip ediyor” bilgisi olmayan hesapları aday kabul eder.
- Whitelist ve keyword filtrelerini uygular.
- Kullanıcı başlattıktan sonra X onayını otomatik tamamlayarak işlemi doğrular.
- Free için 50, Pro için 500 gerçek işlemlik kayan 24 saat penceresi uygular.
- Önizleme modunda hesapları listeler fakat takipten çıkarmaz; sayaçları gerçeğinden ayrı tutar.
- Son çalışma özetinde gerçek, önizlenen, atlanan ve başarısız sonuçları saklar.
- Gerçek işlemler için 30 günlük grafik ve Pro CSV dışa aktarma sunar.
- Yeniden takibi otomatik yapmaz; son profilleri manuel değerlendirme için açar.

## Mimari ve veri

- Manifest V3 tabanlı Chrome eklentisidir.
- Content script tarama ve takipten çıkarma motorudur.
- Popup kontrol, filtre, sayaç ve raporlama arayüzüdür.
- Background worker Gumroad lisansını doğrular ve storage migration'ını başlatır; durum mesajlarını tekrar iletmez.
- X kullanıcı adları, geçmiş, filtreler, çalışma durumu ve tercihler `chrome.storage.local` içinde tutulur.
- X verileri geliştirici sunucusuna veya Gumroad'a gönderilmez. Gumroad'a yalnızca Pro lisans doğrulama isteği gider.
- Güncel storage şeması `schemaVersion: 4` değerindedir.

## Tamamlanan düzeltmeler

- Free/Pro limiti otomasyon motoruyla eşitlendi.
- Yanıltıcı Undo akışı, manuel profil açma davranışı olarak adlandırıldı.
- Scroll, stop, rate-limit, hedef dialog ve başarı doğrulaması dayanıklı hale getirildi.
- Önizleme, gerçek sayaç ve güvenlik kotasından ayrıldı.
- Aynı kullanıcının popup listesinde yinelenmesi engellendi.
- Son çalışma durumu popup yeniden açıldığında geri yükleniyor.
- CSV formül enjeksiyonu koruması eklendi.
- Lisans yenileme, iptal ve çevrimdışı durumları ele alındı.
- Migration, lint, format, unit, fixture, E2E ve CI altyapısı eklendi.

## Bilinen sınırlar

- Tespit X'in görünür DOM'una ve arayüz metinlerine bağlıdır.
- İngilizce ve Türkçe X metinleri ana hedeftir; popup'ın Almanca olması tam Almanca DOM desteği anlamına gelmez.
- Rate-limit algılama görünür X uyarılarına dayanır ve hesap kısıtlamasını önleme garantisi vermez.
- İstemci tarafı lisanslama manipülasyona karşı mutlak güvenlik sağlamaz.
- Yapılandırılmış tanı raporu yoktur; hata ayrıntıları console ve son çalışma özetindedir.

## Durum

Faz 1–3 tamamlandı; Faz 4 ve mobil/tarayıcı genişletme işleri kapsamdan çıkarıldı. Yayın için kalan dış adımlar [CHROME_WEB_STORE_PLAN.md](CHROME_WEB_STORE_PLAN.md) içinde listelenir.
