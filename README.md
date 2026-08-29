# X Unfollow Radar

X/Twitter **Following** sayfasında seni takip etmiyor görünen hesapları bulan ve filtrelere göre kontrollü biçimde takipten çıkaran Chrome eklentisi.

## Özellikler

- Otomatik tarama ve kaydırma
- Tek başlatma adımıyla otomatik takipten çıkarma
- Whitelist ve keyword filtreleri
- **Önizleme modu:** Hesapları listeler, takipten çıkarmaz
- İşlemler arasında 2–5 saniye rastgele gecikme
- Kayan 24 saatlik limit: Free 50, Pro 500 gerçek işlem
- Gerçek, önizlenen, atlanan ve başarısız sonuçları gösteren son çalışma özeti
- Gerçek işlemler için 30 günlük grafik; Pro planda CSV dışa aktarma
- Son 10 gerçek işlem profilini manuel yeniden takip için açma
- Saklanan rate-limit beklemesi ve otomatik devam
- Açık/koyu tema; Türkçe, İngilizce ve Almanca popup
- Gumroad lisans anahtarıyla Pro aktivasyonu

> Tespit, X'in kullanıcı kartında gösterdiği **Follows you / Seni takip ediyor** bilgisine dayanır. Önizleme modu sonucunu kontrol etmek için kullanılabilir.

## Kurulum

1. Repoyu indir veya klonla.
2. Chrome'da `chrome://extensions` adresini aç.
3. **Geliştirici modu**nu etkinleştir.
4. **Paketlenmemiş öğe yükle** ile proje klasörünü seç.
5. Eklentiyi veya kaynak kodunu güncellediğinde eklentiyi ve açık X sekmesini yenile.

## Kullanım

1. X hesabında `https://x.com/KULLANICI_ADI/following` sayfasını aç.
2. İstersen whitelist, keyword filtreleri veya Önizleme modunu ayarla.
3. **Takipten çıkarmayı başlat** düğmesine bas.
4. İstediğin zaman **Durdur** düğmesini kullan.

Eklenti uygun hesaplarda X'in takipten çıkarma onayını otomatik tamamlar. Yeniden takip otomatik değildir; ilgili profil manuel olarak açılır.

## Limitler ve veri

| Konu          | Davranış                                                        |
| ------------- | --------------------------------------------------------------- |
| Free limit    | Son 24 saatte 50 gerçek işlem                                   |
| Pro limit     | Son 24 saatte 500 gerçek işlem                                  |
| Önizleme      | Gerçek kotayı tüketmez; ayrı sayaçlarda tutulur                 |
| Geçmiş        | Gerçek işlemler en fazla 30 gün saklanır                        |
| Son profiller | En fazla 10 kullanıcı                                           |
| Rate limit    | Görünür X uyarısı algılanırsa 15 dakika bekler                  |
| Veriler       | X hesap yönetimi verileri `chrome.storage.local` içinde tutulur |
| Harici istek  | Yalnızca Pro lisans doğrulaması için Gumroad                    |

Tam veri açıklaması için [PRIVACY_POLICY.md](PRIVACY_POLICY.md) dosyasına bak.

## Geliştirme

```bash
npm ci
npm run format:check
npm run lint
npm test
npm run test:e2e
npm run package:check
npm run release:check
```

Yeni sürüm:

```bash
npm run release -- patch
# veya
npm run release -- 2.1.0
```

Bu komut `package.json`, `package-lock.json` ve `manifest.json` sürümlerini eşitler.

## Proje yapısı

```text
src/background/   Gumroad lisansı ve storage migration
src/content/      X sayfasındaki tarama ve işlem motoru
src/popup/        Popup arayüzü
src/shared/       Sabitler, migration ve test edilebilir yardımcılar
locales/          TR/EN/DE çevirileri
tests/            Unit, fixture, smoke ve Playwright testleri
assets/           İkonlar ve mağaza varlıkları
docs/             Mimari, durum ve yayın belgeleri
```

## Sınırlar

- Yalnızca Chrome Manifest V3 hedeflenir.
- X DOM'u veya metinleri değişirse tespit güncellemesi gerekebilir.
- Kontrollü tempo hesap kısıtlaması yaşanmayacağını garanti etmez.
- Almanca popup desteği, Almanca X DOM metinlerinin tamamının algılandığı anlamına gelmez.

Sorunlar için [GitHub Issues](https://github.com/berkayismus/x-unfollow-radar/issues) kullanılabilir.

**Uyarı:** Eklentiyi kendi sorumluluğunda kullan. Aşırı işlem X tarafından hesap kısıtlamasına yol açabilir.
