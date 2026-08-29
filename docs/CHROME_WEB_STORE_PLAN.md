# Chrome Web Store Yayın Planı

Kod ve metin hazırlığı tamamlandı. Kalan işler mağaza hesabı ve güncel görsel gerektirir.

## Hazır

- [x] Manifest V3, gerekli izinler ve 16/48/128 ikonları
- [x] Güncel Türkçe/İngilizce mağaza metni
- [x] Gizlilik politikası
- [x] Lint, format, unit/smoke, fixture, Playwright ve paket kontrolleri
- [x] Storage migration ve sürüm senkronizasyonu

## Kalan işler

- [ ] Chrome Web Store geliştirici hesabını ve destek e-postasını doğrula
- [ ] Gizlilik politikası URL'sinin herkese açık olduğunu kontrol et
- [ ] Eski mağaza ekran görüntülerini güncel arayüzle yeniden üret
- [ ] Promo görsellerini güncel metin ve limitler açısından kontrol et; gerekirse yenile
- [ ] Temiz ZIP üret ve Dashboard'a yükle
- [ ] Privacy practices ve single-purpose beyanlarını doldur
- [ ] Dağıtımı seç ve incelemeye gönder

## Önemli görsel uyarısı

`assets/store-screenshots/` içindeki mevcut üç görsel yayın için güncel değildir. `100/24h`, “Rate-limit safe”, kullanıcı onayı ve “Dry run” gibi kaldırılmış ifadeler içerir. Yeni görseller Free `50/24h`, Pro `500/24h`, otomatik işlem ve **Preview mode** davranışını göstermelidir.

## Doğrulama ve paketleme

```bash
npm ci
npm run format:check
npm run lint
npm test
npm run test:e2e
npm run package:check
npm run release:check
zip -r x-unfollow-radar.zip manifest.json src assets/icons locales vendor -x "*.DS_Store"
```

Yeni sürüm gerekiyorsa önce `npm run release -- patch` çalıştırılmalıdır.

## Kaynaklar

- [Geliştirici hesabı](https://developer.chrome.com/docs/webstore/register)
- [Yayınlama](https://developer.chrome.com/docs/webstore/publish/)
- [Görsel gereksinimleri](https://developer.chrome.com/docs/webstore/images)
- [Gizlilik](https://developer.chrome.com/docs/webstore/program-policies/privacy)

Güncel Dashboard ve program politikaları bu belgeden önceliklidir.
