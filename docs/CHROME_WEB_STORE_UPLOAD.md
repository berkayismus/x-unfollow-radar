# Chrome Web Store'a Yükleme Adımları

Bu belge, X Unfollow Radar için doğrulanmış kaynaklardan temiz bir ZIP üretme ve Chrome Web Store Developer Dashboard'a gönderme adımlarını özetler.

## 1. Gönderim öncesi doğrulama

Proje kökünde:

```bash
npm ci
npm run lint
npm test
npm run test:e2e
npm run package:check
npm run release:check
```

Yeni bir mağaza sürümü hazırlanıyorsa önce sürümü yükseltin ve testleri yeniden çalıştırın:

```bash
npm run release -- patch
```

## 2. Temiz ZIP oluşturma

Bu repoda hazır bir `x-unfollow-radar.zip` takip edilmiyor. Paketi yalnızca çalışma zamanı dosyalarından üretin:

```bash
zip -r x-unfollow-radar.zip manifest.json src assets/icons locales vendor -x "*.DS_Store"
```

Bu yöntem `node_modules`, testler, dokümanlar, Git geçmişi ve mağazaya ayrıca yüklenecek tanıtım görsellerini extension paketinin dışında bırakır. ZIP'i açıp `manifest.json` dosyasının arşiv kökünde olduğunu kontrol edin.

## 3. Hazır mağaza varlıkları

- Gizlilik politikası: `PRIVACY_POLICY.md`
- Türkçe ve İngilizce açıklamalar: `STORE_LISTING.md`
- 1280x800 ekran görüntüleri: `assets/store-screenshots/`
- 440x280 küçük tanıtım görseli: `assets/promo/x-unfollow-radar-tile-en-440x280.png`
- 1400x560 marquee görseli: `assets/promo/x-unfollow-radar-hero-en-1400x560.png`
- 16/48/128 ikonları: `assets/icons/`

## 4. Developer hesabı

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) sayfasına gidin.
2. Yayıncı hesabını kaydedin, gösterilen tek seferlik kayıt ücretini ödeyin ve sözleşmeleri kabul edin.
3. Sık kontrol edilen bir geliştirici e-postası kullanın ve gerekli hesap doğrulamalarını tamamlayın.

Güncel hesap adımları için [resmî kayıt rehberini](https://developer.chrome.com/docs/webstore/register) esas alın.

## 5. Yeni öğe ve mağaza kaydı

1. Dashboard'da **Add new item / New item** seçeneğini açın.
2. `x-unfollow-radar.zip` dosyasını yükleyin.
3. **Store listing** alanlarını `STORE_LISTING.md` içeriğiyle doldurun.
4. Kısa açıklama olarak şu güncel metni kullanın:

    `Seni takip etmeyen hesapları tespit et; filtreler, dry-run ve kontrollü işlem temposuyla following listeni yönet.`

5. `assets/store-screenshots/` altındaki ekran görüntülerini ve küçük tanıtım görselini yükleyin.
6. Kategoriyi **Productivity** olarak değerlendirin.

## 6. Privacy, dağıtım ve destek

- Privacy Policy URL: `https://github.com/berkayismus/x-unfollow-radar/blob/main/PRIVACY_POLICY.md`
- Privacy practices bölümünde yerel olarak işlenen X kullanıcı adı/sayfa içeriği verilerini ve Gumroad'a gönderilen lisans anahtarını politika ile aynı biçimde beyan edin.
- Extension'ın tek amacını kullanıcı tarafından başlatılan, filtreli ve kontrollü following-listesi yönetimi olarak açıklayın.
- Distribution görünürlüğünü ve bölgeleri seçin.
- Dashboard'da doğrulanmış destek e-postasını girin.
- İsteğe bağlı destek URL'si: `https://github.com/berkayismus/x-unfollow-radar/issues`

Yerel veri işleme de mağaza beyanlarında açıklanmalıdır. Güncel gereksinimler için [Chrome Web Store kullanıcı verisi rehberini](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) kontrol edin.

## 7. İncelemeye gönderme

Tüm zorunlu alanlar tamamlandıktan sonra **Submit for review** seçeneğini kullanın. İnceleme süresi gönderimin niteliğine göre değişir; sabit bir süre varsaymayın. Güncel akış için [resmî yayın rehberini](https://developer.chrome.com/docs/webstore/publish/) izleyin.
