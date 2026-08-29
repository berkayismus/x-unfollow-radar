# Tamamlanan Geliştirme Yol Haritası

Planlanan ürün geliştirmeleri Faz 1–3 kapsamında tamamlandı. Mobil uygulama, Firefox/macOS Safari desteği ve Faz 4 kapsamdan çıkarıldı.

## Faz 1 — Doğruluk ve dayanıklılık

- [x] Free/Pro limitlerini ortak kaynaktan uygula.
- [x] Gerçek işlemleri kayan 24 saatlik pencereyle say.
- [x] Önizlemeyi gerçek işlem ve kotadan ayır.
- [x] Reset işleminin güvenlik penceresini aşmasını engelle.
- [x] X onay penceresini hedef kullanıcıya göre doğrula ve otomatik tamamla.
- [x] Stop, scroll, rate-limit ve ardışık hata davranışlarını dayanıklı hale getir.
- [x] Son çalışma durumunu ve kullanıcı sonuçlarını kalıcı tut.
- [x] Popup'ta aynı kullanıcıyı tek satırda göster.

## Faz 2 — Gizlilik, lisans ve yayın hazırlığı

- [x] Yerel ve harici veri işleme envanterini belgele.
- [x] İstatistik sıfırlama ile tüm verileri silmeyi ayır.
- [x] CSV kaçışı ve formül enjeksiyonu koruması ekle.
- [x] Gumroad `product_id` ile aktivasyon ve 24 saatlik yeniden doğrulama ekle.
- [x] İade, chargeback, dispute, abonelik sonu, süre dolumu ve çevrimdışı grace durumlarını işle.
- [x] Manifest izinlerini gerekli kapsamla sınırla.

## Faz 3 — Test ve bakım

- [x] Syntax, smoke, unit ve UserCell fixture testleri ekle.
- [x] ESLint ve Prettier kontrolleri ekle.
- [x] Playwright ile unpacked-extension testi ekle.
- [x] GitHub Actions doğrulama akışı kur.
- [x] `schemaVersion` tabanlı idempotent migration altyapısı ekle.
- [x] Manifest/package sürüm senkronizasyonu ekle.

## Güncel durum

Yeni bir ürün fazı planlanmıyor. Kalan işler Chrome Web Store hesabı, güncel mağaza görselleri, ZIP yükleme ve inceleme gibi yayın adımlarıdır. Ayrıntılar için [CHROME_WEB_STORE_PLAN.md](CHROME_WEB_STORE_PLAN.md) dosyasına bak.
