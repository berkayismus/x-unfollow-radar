# Chrome Web Store'a Yükleme Adımları

Bu dosya, **x-unfollow-radar.zip** paketini Chrome Web Store'a yüklerken takip edeceğin adımları özetler.

## Hazırlanan dosyalar

- **ZIP paketi:** Proje kökünde `x-unfollow-radar.zip` (manifest ve tüm gerekli dosyalar kökte)
- **Gizlilik politikası:** `PRIVACY_POLICY.md` güncellendi (başlık: X Unfollow Radar, iletişim: GitHub linki)

## 1. Developer hesabı (henüz yoksa)

1. https://chrome.google.com/webstore/devconsole adresine git
2. Google hesabınla giriş yap
3. Tek seferlik **$5** developer kayıt ücretini öde
4. Publisher name ve e-posta doğrulamasını tamamla

## 2. Yeni eklenti yükle

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) → **New Item**
2. **Dosya seç** → Proje klasöründen `x-unfollow-radar.zip` dosyasını seç
3. Yükleme tamamlanınca hata çıkarsa (manifest, ikon vb.) ekrandaki mesaja göre düzeltip ZIP’i yeniden oluşturup tekrar yükle

## 3. Store listing sekmesi

- **Short description (max 132 karakter):**  
  `Seni takip etmeyen kullanıcıları otomatik tespit et ve takipten çık. Güvenli, hızlı, kolay!`
- **Detailed description:** `STORE_LISTING.md` içindeki Türkçe veya İngilizce detaylı açıklamayı kopyala-yapıştır
- **Category:** Productivity
- **Screenshot:** En az 1 adet (1280x800 veya 640x400 px) — eklenti popup’ının ekran görüntüsü yeterli

## 4. Privacy sekmesi

- **Privacy Policy URL:**  
  `https://github.com/berkayismus/x-unfollow-radar/blob/main/PRIVACY_POLICY.md`  
  (Repo public olduğu sürece bu link çalışır.)

## 5. Distribution ve Support

- **Distribution:** Public veya Unlisted tercihini seç
- **Support email:** Chrome Web Store’da görünecek destek e-postasını gir (zorunlu)
- İsteğe bağlı: Support URL olarak `https://github.com/berkayismus/x-unfollow-radar` ekle

## 6. İncelemeye gönder

- Tüm zorunlu alanları doldurduktan sonra **Submit for review** ile gönder
- İnceleme genelde 1–3 iş günü sürer; reddedilirse e-posta ile gerekçe ve düzeltme bilgisi gelir

---

**ZIP’i yeniden oluşturmak için (proje kökünde):**

```bash
zip -r x-unfollow-radar.zip . -x "*.git*" "*/.DS_Store" "*.DS_Store" "README.md" "STORE_LISTING.md" "docs/*" ".cursor/*" "*.zip" "https:*" "https/*"
```
