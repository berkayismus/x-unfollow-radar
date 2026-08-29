# Chrome Web Store Yayın Planı

Bu belge, X Unfollow Radar'ın mevcut yayın hazırlığını ve mağaza gönderiminden önce kalan dış adımları gösterir.

## Mevcut proje durumu

Hazır olanlar:

- [x] Manifest V3 yapılandırması ve 16/48/128 ikonları
- [x] Çalışan ürünle eşitlenmiş Türkçe/İngilizce mağaza metinleri
- [x] Gumroad aktarımı ve yerel veri kullanımını açıklayan gizlilik politikası
- [x] Üç adet 1280x800 mağaza ekran görüntüsü
- [x] 440x280 küçük promo ve 1400x560 marquee görseli
- [x] ESLint, Prettier, unit/smoke, DOM fixture ve Playwright testleri
- [x] GitHub Actions doğrulama akışı
- [x] Storage migration ve release sürüm senkronizasyonu

Dashboard veya yayıncı hesabı gerektiren kalan adımlar:

- [ ] Chrome Web Store geliştirici hesabını kaydet ve doğrula
- [ ] Herkese açık gizlilik politikası URL'sinin erişilebilirliğini kontrol et
- [ ] Doğrulanmış destek e-postasını belirle
- [ ] Temiz ZIP paketini üret ve Dashboard'a yükle
- [ ] Privacy practices ve single-purpose beyanlarını doldur
- [ ] Dağıtım seçimini yapıp incelemeye gönder

## Yayın varlıkları

| Varlık              | Konum                                                | Durum            |
| ------------------- | ---------------------------------------------------- | ---------------- |
| Gizlilik politikası | `PRIVACY_POLICY.md`                                  | Hazır            |
| Mağaza açıklaması   | `STORE_LISTING.md`                                   | Hazır            |
| Ekran görüntüleri   | `assets/store-screenshots/`                          | 3 adet hazır     |
| Küçük promo         | `assets/promo/x-unfollow-radar-tile-en-440x280.png`  | Hazır            |
| Marquee             | `assets/promo/x-unfollow-radar-hero-en-1400x560.png` | Hazır            |
| Extension ikonları  | `assets/icons/`                                      | Hazır            |
| ZIP                 | Proje kökünde üretilecek                             | Henüz repoda yok |

## Paketleme ve doğrulama

```bash
npm ci
npm run lint
npm test
npm run test:e2e
npm run package:check
npm run release:check
zip -r x-unfollow-radar.zip manifest.json src assets/icons locales vendor -x "*.DS_Store"
```

Yeni sürüm yüklemeden önce gerekirse `npm run release -- patch` çalıştırılmalı; `package.json`, `package-lock.json` ve `manifest.json` aynı sürümü göstermelidir.

## Dashboard kontrol listesi

- [ ] ZIP içindeki `manifest.json` arşiv kökünde
- [ ] Store açıklaması gerçek tek-adımlı “başlat → tara ve işle” davranışını anlatıyor
- [ ] Privacy practices, `PRIVACY_POLICY.md` ile aynı veri türlerini ve Gumroad aktarımını bildiriyor
- [ ] En az bir ekran görüntüsü ve küçük promo yüklendi
- [ ] Destek e-postası ve gizlilik politikası URL'si erişilebilir
- [ ] Test talimatı gerekiyorsa Following sayfası ve Pro lisans akışı açıkça anlatıldı
- [ ] Distribution ayarları seçildi

## Resmî kaynaklar

- [Geliştirici hesabı kaydı](https://developer.chrome.com/docs/webstore/register)
- [Chrome Web Store'da yayınlama](https://developer.chrome.com/docs/webstore/publish/)
- [Görsel gereksinimleri](https://developer.chrome.com/docs/webstore/images)
- [Gizlilik politikası gereksinimleri](https://developer.chrome.com/docs/webstore/program-policies/privacy)

Dashboard alanları ve güncel program politikaları bu belgeye göre önceliklidir.
