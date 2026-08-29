# Chrome Web Store Yükleme

## 1. Doğrula

Proje kökünde:

```bash
npm ci
npm run format:check
npm run lint
npm test
npm run test:e2e
npm run package:check
npm run release:check
```

Yeni mağaza sürümünde önce `npm run release -- patch` çalıştır ve testleri tekrarla.

## 2. Güncel görselleri hazırla

Mevcut `assets/store-screenshots/` dosyaları eski arayüzü gösterdiği için kullanılmamalıdır. Main, Filters ve Statistics görsellerini güncel eklentiden yeniden üret. Promo görsellerini de eski limit ve terminoloji açısından kontrol et.

## 3. ZIP oluştur

```bash
zip -r x-unfollow-radar.zip manifest.json src assets/icons locales vendor -x "*.DS_Store"
```

ZIP kökünde `manifest.json` bulunduğunu doğrula. `node_modules`, testler, dokümanlar ve mağaza tanıtım görselleri pakete girmez.

## 4. Dashboard'a yükle

1. [Developer Dashboard](https://chrome.google.com/webstore/devconsole) içinde yeni öğe oluştur.
2. ZIP'i yükle.
3. Genel metinleri [../STORE_LISTING.md](../STORE_LISTING.md), emojili İngilizce açıklamayı [CHROME_WEB_STORE_DESCRIPTION_EN.md](CHROME_WEB_STORE_DESCRIPTION_EN.md) dosyasından al.
4. Güncel ekran görüntülerini ve küçük promo görselini yükle.
5. Kategoriyi **Productivity** olarak değerlendir.

## 5. Gizlilik ve destek

- Gizlilik URL'si: `https://github.com/berkayismus/x-unfollow-radar/blob/main/PRIVACY_POLICY.md`
- Destek URL'si: `https://github.com/berkayismus/x-unfollow-radar/issues`
- Doğrulanmış destek e-postası gir.
- Yerel X verilerini ve Gumroad'a gönderilen Pro lisans anahtarını gizlilik beyanında açıkla.
- Tek amacı, kullanıcı tarafından başlatılan filtreli Following-listesi yönetimi olarak belirt.

## 6. Gönder

Zorunlu alanlar ve dağıtım ayarları tamamlandıktan sonra **Submit for review** kullan. Sabit inceleme süresi varsayma; güncel [resmî yayın rehberini](https://developer.chrome.com/docs/webstore/publish/) izle.
