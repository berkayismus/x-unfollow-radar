# X Unfollow Radar - Chrome Extension

Seni takip etmeyen kullanıcıları otomatik tespit edip takipten çıkaran Chrome eklentisi.

## 🎯 Özellikler

### Temel Özellikler
- ✅ Otomatik scroll ve kullanıcı taraması
- ✅ "Follows you" badge'i olmayan kullanıcıları tespit eder
- ✅ İşlemler arasında 2-5 saniye kontrollü gecikme
- ✅ Ücretsiz planda 50, Pro planda 500 işlem/24 saat limiti
- ✅ Gerçek işlemleri ayrı ayrı izleyen kayan son 24 saat güvenlik sayacı
- ✅ Batch modu: Pro planda ilk 50 gerçek işlemden sonra devam onayı ister
- ✅ Toplam istatistik saklama
- ✅ Kalıcı çalışma özeti: gerçek, dry-run, atlanan ve başarısız sonuçlar
- ✅ Popup yeniden açıldığında son çalışma listesini geri yükleme
- ✅ Rate-limit bekleme durumunu saklama ve zaman dolunca otomatik devam

### Gelişmiş Özellikler
- 🔍 **Keywords Filter**: Bio'da belirli kelimeleri içeren kullanıcıları atla
- 🛡️ **Whitelist**: Belirli kullanıcıları koruma altına al
- 📊 **30 Günlük Chart**: Chartist.js ile görsel istatistikler
- 📥 **CSV Export (Pro)**: İşlem geçmişini güvenli CSV formatında indir
- 🌙 **Dark Mode**: Karanlık tema desteği
- 🌐 **Çoklu Dil Desteği**: Türkçe, İngilizce ve Almanca arayüz (TR/EN/DE)
-  **User List**: İşlenen kullanıcıların canlı listesi
  - ↗ Profili açıp manuel yeniden takip etme
  - ⭐ Tek tıkla whitelist'e ekle butonu
- 🧪 **Dry-Run Mode**: Gerçekte takipten çıkmadan test et
- ↗ **Recent Profiles**: Son 10 işlemin profilini manuel takip için aç
- ⏱️ **Smart Rate Limit**: 15 dakika sonra otomatik devam

## 📦 Kurulum

### Lokal Kurulum (Geliştirici Modu)

1. Bu klasörü bilgisayarınıza indirin
2. Chrome'da `chrome://extensions` sayfasını açın
3. Sağ üstten "Developer mode" (Geliştirici modu) aktif edin
4. "Load unpacked" (Paketlenmemiş yükle) butonuna tıklayın
5. Bu klasörü seçin
6. Eklenti yüklendi! 🎉

### Chrome Web Store'dan Kurulum (Yakında)

Extension Chrome Web Store'da yayınlandıktan sonra direkt oradan kurulabilecek.

## 🚀 Kullanım

1. Twitter/X hesabınıza giriş yapın
2. "Following" (Takip Edilenler) sayfasına gidin:
   - `https://twitter.com/[kullanıcı-adınız]/following`
   - veya `https://x.com/[kullanıcı-adınız]/following`
3. Eklenti simgesine tıklayın
4. **Opsiyonel:** Filtreler tab'ından keywords veya whitelist ekleyin
5. **Opsiyonel:** Dry-run mode'u aktif edin (gerçekte takipten çıkmadan test için)
6. "Başlat" butonuna tıklayın
7. Ücretsiz plan 50 işlemde durur; Pro plan ilk 50 işlemden sonra devam onayı ister
8. Pro planda "Devam Et" diyerek kalan günlük limite kadar ilerleyin
9. İstediğiniz zaman "Durdur" ile durdurabilirsiniz
10. İstatistikler tab'ından geçmişi görebilir ve CSV olarak indirebilirsiniz

## ⚙️ Ayarlar ve Limitler

- **24 Saatlik Limit**: Ücretsiz 50 / Pro 500 gerçek unfollow
- **Batch Sistemi**: Pro planda ilk 50 işlem → açık devam onayı
- **Toplam Limit**: Sınırsız (istatistik olarak tutuluyor)
- **Gecikme**: 2-5 saniye (rastgele)
- **Güvenlik penceresi**: Her gerçek işlem, yapıldığı andan 24 saat sonra sayaçtan çıkar
- **Rate Limit**: 15 dakika otomatik bekleme ve devam
- **Recent Profiles**: Son 10 işlemin profili manuel yeniden takip için açılabilir
- **History**: 30 günlük geçmiş saklanır
- **Lisans Doğrulama**: Pro anahtarı Gumroad ile aktive edilir ve periyodik olarak yeniden doğrulanır

## ⚠️ Önemli Uyarılar

1. **Rate Limit**: Twitter/X günlük işlem limitleri vardır. Eğer çok fazla işlem yaparsanız geçici olarak kısıtlanabilirsiniz.
2. **Ban Riski**: Bu eklenti dikkatli kullanılmalıdır. Aşırı kullanım hesap kısıtlamalarına yol açabilir.
3. **Geri Alma**: Takipten çıkarılan kişileri otomatik geri takip etmez, manuel eklemeniz gerekir.
4. **Doğruluk**: Twitter/X ara sıra sayfa yapısını değiştirir, bu durumda eklenti çalışmayabilir.

## 🛠️ Teknik Detaylar

### Teknolojiler
- Chrome Extension Manifest V3
- Vanilla JavaScript (No frameworks)
- Chrome Storage API
- Chrome Messaging API

### Dosya Yapısı
```
x_unfollow_radar/
├── manifest.json              # Extension configuration (Manifest V3)
├── README.md                  # This file
├── PRIVACY_POLICY.md          # Privacy policy
├── STORE_LISTING.md           # Chrome Web Store listing
│
├── src/                       # Source code
│   ├── background/
│   │   └── index.js           # Service worker for message relay
│   ├── content/
│   │   └── index.js           # Main automation logic
│   ├── popup/
│   │   ├── popup.html         # 3-tab UI (Ana/Filtreler/İstatistikler)
│   │   ├── popup.js           # UI controller and handlers
│   │   └── popup.css          # CSS with dark mode support
│   └── shared/
│       ├── constants.js       # Centralized configuration
│       └── i18n.js            # Internationalization module
│
├── assets/                    # Static assets
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
│
├── vendor/                    # Third-party libraries
│   ├── chartist.min.js        # Chart library
│   └── chartist.min.css       # Chart styles
│
└── locales/                   # Language files
    ├── tr.json                # Turkish translations
    ├── en.json                # English translations
    └── de.json                # German translations
```

### Güvenlik Önlemleri
- Rastgele gecikmeler (2-5 saniye)
- Ücretsiz 50 / Pro 500 işlem limiti
- Organik duraklamalar (%10 rastgele)
- Algılanan rate-limit bekleme durumunu saklama ve otomatik devam
- 24 saatlik reset mekanizması

## 🤝 Katkıda Bulunma

Bu proje MVP (Minimum Viable Product) olarak geliştirilmiştir. Katkılarınızı bekliyoruz!

## 📄 Lisans

Bu proje kişisel kullanım içindir. Ticari kullanım için iletişime geçin.

## 🐛 Bilinen Sorunlar

- Twitter/X sayfa yapısı değişirse selektörler güncellenmelidir
- Rate limit durumunda 15 dakika otomatik bekleme yapılır

## 📞 Destek

Sorun yaşarsanız veya öneriniz varsa lütfen issue açın.

---

---

**⚠️ UYARI**: Bu eklentiyi kendi sorumluluğunuzda kullanın. Aşırı kullanım Twitter/X tarafından hesap kısıtlamalarına yol açabilir.

*Son güncelleme: Ağustos 2026*
