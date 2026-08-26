# X Unfollow Radar - Ürün ve Teknik Analiz Raporu

**İnceleme tarihi:** 2 Ağustos 2026

**İncelenen sürüm:** `2.0.3`

**Kapsam:** Manifest, content script, popup, background service worker, yerel veri modeli, lisanslama, i18n, gizlilik ve mağaza dokümanları

## 1. Yönetici özeti

X Unfollow Radar; küçük, anlaşılır ve bağımlılığı az bir Chrome eklentisi olarak iyi bir MVP temeline sahip. Otomasyon motoru, filtreler, dry-run, yerel geçmiş, grafik, CSV, çoklu dil ve Pro lisans ekranı tek pakette bulunuyor. Kodun framework kullanmaması paket boyutunu ve ilk geliştirme maliyetini düşük tutuyor.

Buna karşılık ürünün yayınlanabilir ve ücretli bir ürün olarak güvenilir sayılabilmesi için önce bazı temel davranışların düzeltilmesi gerekiyor. En kritik sonuçlar şunlardır:

1. **Pro planın 500/gün limiti arayüzde gösteriliyor fakat otomasyon motoru her kullanıcıyı 50 işlemde durduruyor.**
2. **“Geri Al” işlemi yeniden takip etmiyor; yalnızca profil sayfasını açıyor ve kullanıcıyı geri alma kuyruğundan çıkarıyor.**
3. **Rate-limit koruması gerçek bir HTTP 429 cevabını güvenilir biçimde gözlemlemiyor; sayfa yenilenince kayıtlı bekleme süresi otomasyonu durdurmuyor.**
4. **Scroll bitiş algoritması yeni kullanıcılar yüklenirken dahi erken durabilir ve X'in sanallaştırılmış listesiyle uyumlu değil.**
5. **Filtreler ve İstatistikler panellerinde `hidden` niteliği kaldırılmadığı için sekmeler görünmeyebilir.**
6. **Gizlilik politikası kodla açıkça çelişiyor:** kullanıcı adları yerelde saklanıyor ve lisans anahtarı Gumroad'a gönderiliyor; politika ise bunların yapılmadığını söylüyor.
7. **Otomatik toplu unfollow ürünün en büyük platform riskidir.** X'in güncel otomasyon kuralları toplu/agresif/ayrım gözetmeyen otomatik takipten çıkarmayı yasaklıyor.

Önerilen sıra: önce P0 doğruluk ve gizlilik sorunları, ardından otomasyon dayanıklılığı, daha sonra test altyapısı ve yeni ürün özellikleri.

## 2. Mevcut ürünün güçlü yönleri

- Manifest V3 ve minimum izin yaklaşımı kullanılıyor.
- Ana yapı `content`, `popup`, `background` ve `shared` olarak ayrılmış.
- DOM'a kullanıcı girdisi yazarken çoğunlukla `textContent` ve güvenli element oluşturma yardımcıları kullanılıyor.
- Whitelist ve keyword filtreleri ürünün temel değer teklifini güçlendiriyor.
- Dry-run, kontrollü kullanım için doğru bir ürün özelliği.
- 30 günlük istatistik, CSV, karanlık tema ve TR/EN/DE dil desteği mevcut.
- Çeviri dosyalarının anahtar kümeleri birbiriyle tutarlı; denetimde eksik anahtar bulunmadı.
- Chartist yerel paketlenmiş; uzaktan script çalıştırılmıyor.
- JavaScript dosyaları `node --check` sözdizimi kontrolünden geçti.

## 3. Öncelikli bulgular

### P0 - Yayın veya satış öncesi çözülmeli

#### P0.1 - Pro günlük limiti uygulanmıyor

`Constants.LIMITS.PRO_MAX_SESSION` 500 olarak tanımlı ve popup Pro kullanıcıya `500` gösteriyor. Buna karşın content script tüm kontrol noktalarında sabit `Constants.LIMITS.MAX_SESSION` değerini kullanıyor; bu değer 50.

**Etkisi:** Kullanıcı Pro lisansı satın alsa bile otomasyon 50'de durur. Bu hem temel ürün hatası hem de ücretli özellik vaadi açısından ticari risktir.

**Öneri:**

- Content script başlangıcında doğrulanmış planı yükleyin.
- Tek bir `getEffectiveSessionLimit(plan)` fonksiyonu oluşturun.
- Popup ve content script aynı hesaplama kaynağını kullansın.
- Free, Pro, expired ve lisans doğrulama hatası için otomatik test ekleyin.

**Kod:** `src/shared/constants.js:57-65`, `src/content/index.js:472-495`, `src/popup/popup.js:264-278`

#### P0.2 - “Undo” gerçek bir geri alma değil

`refollowUser()` yalnızca profil URL'sini logluyor ve `true` dönüyor. Popup tarafı profili yeni sekmede açıyor; bundan önce kullanıcı kayıtlı undo kuyruğundan çıkarılıyor.

**Etkisi:** Arayüz işlemin geri alındığı izlenimini oluşturuyor fakat kullanıcı yeniden takip edilmiş olmuyor. Profil açma başarısız olsa bile geri alma kaydı kaybolabiliyor.

**Öneri:**

- Özelliğin adını şimdilik “Profili aç ve yeniden takip et” olarak değiştirin.
- Kuyruk kaydını ancak kullanıcı işlemi tamamladığını onayladığında kaldırın.
- Gerçek geri alma isteniyorsa kullanıcı onaylı bir follow akışı tasarlayın; otomatik follow/unfollow politikasını ayrıca değerlendirin.

**Kod:** `src/content/index.js:355-370`, `src/popup/popup.js:675-704`, `src/popup/popup.js:1190-1223`

#### P0.3 - Gizlilik politikası gerçek davranışla çelişiyor

Politika “harici servise veri gönderilmez”, “üçüncü taraf servis kullanılmaz” ve “unfollow edilen kullanıcı adları saklanmaz” diyor. Kod ise:

- Lisans anahtarını Gumroad API'sine gönderiyor.
- Lisans anahtarını yerel storage'da düz metin saklıyor.
- Unfollow edilen kullanıcı adlarını 30 günlük geçmişte saklıyor.
- Whitelist kullanıcı adlarını ve keyword filtrelerini saklıyor.
- Reset butonu tüm bu verileri silmiyor.

Manifest de Gumroad host izni içeriyor.

**Etkisi:** Chrome Web Store incelemesi, kullanıcı güveni ve hukuki beyanlar bakımından yüksek risk.

**Öneri:**

- Gizlilik politikasını gerçek veri envanteriyle yeniden yazın.
- Veri türü, amaç, saklama süresi, üçüncü taraf, silme yöntemi ve lisans doğrulama aktarımını açıkça belirtin.
- “GDPR/CCPA uyumludur” gibi doğrulanmamış kesin beyanları kaldırın veya hukuki incelemeyle destekleyin.
- “Tüm verileri sil” işlemi ile istatistik, geçmiş, filtre, whitelist, rate-limit, lisans ve tercihleri gerçekten silin; istenirse “sadece sayaçları sıfırla” ayrı işlem olsun.

**Kod/doküman:** `PRIVACY_POLICY.md:5-58`, `manifest.json:10-14`, `src/background/index.js:43-90`, `src/content/index.js:197-212`, `src/popup/popup.js:647-671`

#### P0.4 - Rate-limit koruması güvenilir değil

Mevcut kod ancak DOM tıklaması sırasında oluşan JavaScript hatasının mesajında `429` geçerse rate-limit çalıştırıyor. Bir buton tıklaması X'in ağ cevabını exception olarak content script'e iletmez. Ayrıca `rateLimitUntil` storage'dan yüklendiğinde yalnızca durum mesajı gönderiliyor; `isPaused = true` yapılmıyor ve kalan süre için yeniden zamanlayıcı kurulmuyor.

**Etkisi:** “Rate-limit safe” ürün vaadi gerçeği yansıtmıyor. Sayfa yenileme veya sekmeyi kapatıp açma korumayı aşabiliyor.

**Öneri:**

- “Rate-limit safe” ifadesini güvenilir tespit tamamlanana kadar kaldırın.
- X arayüzündeki hata/toast/dialog durumlarını gözlemleyen bir durum algılayıcı ekleyin.
- Her aksiyon öncesinde `rateLimitUntil` kontrolü yapın; storage'da aktifse kesin olarak pause edin.
- Beklemeyi tek bir uzun `setTimeout` yerine timestamp tabanlı ve yeniden başlatılabilir yapın.
- Arka arkaya başarısız buton/confirm bulma durumunda circuit breaker uygulayın.

**Kod:** `src/content/index.js:219-259`, `src/content/index.js:343-349`, `src/content/index.js:639-644`

#### P0.5 - Scroll algoritması erken tamamlandı sonucu verebilir

Scroll sonrası kullanıcı sayısı büyüdüğünde `lastUserCellCount` hemen yeni değere eşitleniyor. Ardından `currentUserCellCount <= lastUserCellCount` kontrolü doğal olarak doğru olabiliyor ve `atBottomStreak` artıyor. Üstelik X listeleri sanallaştırıldığı için ekrandaki DOM kartı sayısı sabit kalırken kullanıcılar değişebilir.

**Etkisi:** Eklenti listenin tamamını taramadan “tamamlandı” diyebilir. Bazı kullanıcılar hiç değerlendirilmez.

**Öneri:**

- Bitiş kararını DOM elemanı sayısından değil son görülen kullanıcı adı/ID kümesindeki büyümeden üretin.
- `MutationObserver` ile yeni `UserCell` eklenmesini bekleyin.
- “Yeni benzersiz kullanıcı yok” durumunu birkaç zaman penceresi ve scroll denemesinden sonra doğrulayın.
- X'in sanallaştırılmış liste davranışı için fixture tabanlı entegrasyon testi oluşturun.

**Kod:** `src/content/index.js:418-428`, `src/content/index.js:516-565`

#### P0.6 - Filtreler ve İstatistikler sekmeleri gizli kalabilir

HTML'de pasif panellere `hidden` niteliği verilmiş. `switchTab()` yalnızca `active` class'ını değiştiriyor; `hidden` niteliğini kaldırmıyor. Tarayıcının kullanıcı aracısı stili `hidden` elemanı göstermediği için bu iki panel açılmayabilir.

**Öneri:** Her geçişte `content.hidden = !isActive` yapın. Aynı anda tab butonlarının `tabindex` değerlerini de `0/-1` olarak güncelleyin.

**Kod:** `src/popup/popup.html:162-193`, `src/popup/popup.js:159-177`

#### P0.7 - X otomasyon politikası ürün modelini tehdit ediyor

X'in resmi kuralları toplu, agresif veya ayrım gözetmeyen otomatik follow/unfollow işlemlerini yasaklıyor. Rastgele gecikme eklemek tek başına uyumluluk sağlamaz.

**Etkisi:** Kullanıcı hesaplarının kısıtlanması, eklentinin mağazadan kaldırılması ve ticari modelin sürdürülememesi riski.

**Öneri:**

- Ürünü “analiz ve kullanıcı onaylı temizlik” yönüne taşıyın.
- Önce adayları listeleyin; kullanıcı seçiminden sonra açık onayla işlem yapın.
- Güvenlik iddialarını “riski azaltır” biçiminde dürüstçe ifade edin; “X kurallarına uygun” demeyin.
- Yayından önce X otomasyon kuralları ve Chrome Web Store politikaları için hukuki/politika incelemesi yapın.

**Resmi kaynak:** [X Automation Rules](https://help.x.com/en/rules-and-policies/x-automation)

### P1 - Güvenilirlik ve veri doğruluğu

#### P1.1 - Takipçi tespiti metne ve dile fazla bağımlı

- “Follows you” kontrolü sadece İngilizce ve Türkçe metinleri tanıyor.
- Arayüz Almanca desteklediği halde Almanca X metinleri tanınmıyor.
- Kullanıcı kartının bio metninde aynı ifade geçerse yanlış pozitif oluşabilir.
- Badge henüz yüklenmeden tarama yapılırsa takip eden kişi yanlışlıkla aday olabilir.

**Öneri:** Badge'e özgü DOM yapısını hedefleyin, desteklenen X arayüz dillerini genişletin, belirsiz kartları işlemeyin ve aksiyon öncesi ikinci doğrulama yapın.

#### P1.2 - Global confirm butonu yanlış işlemi onaylayabilir

Takipten çıkarma onayı `document.querySelector()` ile tüm sayfadaki ilk confirm butonundan alınıyor. Dialog'un gerçekten hedef kullanıcıya ait olduğu doğrulanmıyor.

**Öneri:** Aktif dialog'u scope olarak kullanın; hedef kullanıcı/metin doğrulaması yapın; dialog bulunamazsa butonu kapatıp kullanıcıyı başarısız olarak işaretleyin.

#### P1.3 - Stop bir işlemi anında durdurmuyor

`randomDelay()` iptal edilemiyor. Kullanıcı Stop'a bastığında o anda devam eden tıklama/delay zinciri tamamlanıp bir unfollow daha yapabilir.

**Öneri:** `AbortController` veya iptal token'ı kullanın; her tıklama öncesi ve sonrası çalışma durumunu yeniden kontrol edin.

#### P1.4 - Günlük pencere gerçek “son 24 saat” hesabı değil

Sayaç ilk oturum başlangıcından 24 saat sonra topluca sıfırlanıyor. Bu, kayan son-24-saat limiti değildir. Reset butonu da kullanıcıya limiti manuel aşma imkânı veriyor.

**Öneri:** Aksiyon timestamp'lerini tutup son 24 saat içindekileri sayın. Güvenlik limiti kullanıcı resetinden bağımsız olsun.

#### P1.5 - Batch durumu yeni günde sıfırlanmıyor

24 saat sonunda `sessionCount` sıfırlanıyor fakat `testComplete` sıfırlanmıyor. İlk batch onayı bir kez geçildikten sonra sonraki günlerde atlanabilir.

**Öneri:** Session reset ile `testComplete` ve session'a ait diğer durumları birlikte sıfırlayın.

#### P1.6 - Dry-run gerçek istatistikleri kirletiyor

Dry-run sırasında `sessionCount` ve günlük `unfollowed` istatistiği artıyor; `totalUnfollowed` artmıyor. Böylece grafik “gerçek unfollow” ile simülasyonu ayıramıyor ve dry-run günlük limiti tüketiyor.

**Öneri:** `actual`, `dryRun`, `skipped`, `failed` sayaçlarını ayrı tutun. Kullanıcıya simülasyon ve gerçek sonuçları ayrı gösterin.

#### P1.7 - Başarı yalnızca tıklama üzerinden varsayılıyor

Confirm butonuna tıklanınca işlem başarılı sayılıyor. Buton durumu, dialog kapanması veya kartın “Follow” durumuna geçmesi doğrulanmıyor.

**Öneri:** Her işlem için `queued -> attempting -> confirmed -> succeeded/failed` durum makinesi oluşturun ve UI sonucunu doğrulayın.

#### P1.8 - Popup kapatılınca canlı kullanıcı listesi kayboluyor

İşlenen kullanıcı listesi yalnızca açık popup DOM'unda tutuluyor. Popup yeniden açıldığında geçmişten doldurulmuyor; dry-run ve skip kayıtları da kalıcı geçmişe yazılmıyor.

**Öneri:** Son çalışma için sınırlı bir `runLog` saklayın ve popup açıldığında yeniden oluşturun.

### P2 - Güvenlik, lisans ve mağaza hazırlığı

#### P2.1 - Lisans denetimi kolayca manipüle edilebilir

Plan, lisans anahtarı ve aktivasyon tarihi tamamen istemci storage'ında. Lisans sadece aktivasyonda Gumroad'a soruluyor; sonraki açılışlarda sunucu durumu yeniden doğrulanmıyor. Kullanıcı storage değerlerini değiştirerek Pro görünümünü açabilir.

**Öneri:**

- Periyodik yeniden doğrulama ve kısa süreli imzalı entitlement kullanın.
- Ürün ID, chargeback/refund ve kullanım sınırlarını doğrulayın.
- Lisans anahtarını gereksiz yere response içinde popup'a geri göndermeyin.
- `Constants.GUMROAD` ile background içindeki kopya ayarları tek kaynağa indirin.

#### P2.2 - Lisans süresi satın alma gerçeğinden kopuk

365 günlük süre, lisansın satın alma tarihinden değil yerel aktivasyon anından başlıyor. Eklentiyi yeniden kurmak veya farklı cihazda aktive etmek süreyi değiştirebilir.

**Öneri:** Süreyi Gumroad verisindeki satın alma/abonelik durumundan türetin; yerel saat ve storage tek otorite olmasın.

#### P2.3 - Manifest ve gizlilik dokümanı uyuşmuyor

Politika `scripting` iznini açıklıyor fakat manifest bu izni istemiyor. Buna karşılık Gumroad host izni ve lisans aktarımı politika içinde açıklanmıyor.

#### P2.4 - Web-accessible resources kapsamı gereksiz geniş

`locales/*.json` tüm URL'lere açılmış. Çeviriler popup tarafından extension URL'sinden yükleniyor; muhtemelen web-accessible olmaları gerekmiyor.

**Öneri:** İhtiyaç doğrulanırsa kaydı kaldırın veya eşleşmeyi yalnızca gereken domainlere daraltın.

#### P2.5 - CSV standardına uygun escaping eksik

Alanlar doğrudan virgülle birleştiriliyor. Mevcut kullanıcı adı ve ISO tarih çoğunlukla güvenli olsa da ileride reason/metin alanında virgül, tırnak veya satır sonu CSV'yi bozar.

**Öneri:** RFC 4180 uyumlu bir `escapeCsvField()` fonksiyonu kullanın ve formül enjeksiyonuna karşı `=`, `+`, `-`, `@` ile başlayan hücreleri koruyun.

#### P2.6 - Mağaza metinleri ve çalışan ürün farklı

Store listing 100 kişi/oturum ve ilk 5 kişide onay diyor; kod free plan için 50 ve batch için 50 kullanıyor. Footer ve README içinde de eski 100 veya 50+50 ifadeleri bulunuyor.

**Öneri:** Limitleri tek bir ürün spesifikasyonundan üretin ve release kontrol listesine doküman tutarlılık testi ekleyin.

### P3 - Mühendislik kalitesi ve bakım

#### P3.1 - Otomatik test, lint ve CI yok

Proje package/test altyapısı içermiyor. DOM tabanlı otomasyon X değişikliklerine çok hassas olduğundan testsiz sürüm riski yüksek.

**Önerilen minimum:** ESLint, Prettier, Vitest/Jest + jsdom, fixture tabanlı user-card testleri, Playwright ile unpacked extension smoke testleri ve GitHub Actions.

#### P3.2 - Kullanılmayan ve tekrar eden sabitler var

`operationStartTime`, `operationSpeeds`, `SCROLL_CYCLES_BEFORE_PROCESS`, `PROCESS_BATCH_SIZE` ve background içindeki `EXPIRY_WARNING_MS` fiilen kullanılmıyor. Gumroad ayarları iki yerde tanımlı.

**Öneri:** Kullanılmayan kodu kaldırın veya tamamlayın; lint ile `no-unused-vars` uygulayın.

#### P3.3 - Sürüm bilgileri senkron değil

Manifest `2.0.3`, content script logu ve dosya header'ları `2.0.0`, background header'ı `2.1.0` gösteriyor.

**Öneri:** Build/release scriptiyle tek sürüm kaynağı kullanın.

#### P3.4 - Hata gözlemlenebilirliği zayıf

Console loglar fazla fakat yapılandırılmış hata kodları, işlem özeti ve destek için dışa aktarılabilir tanı kaydı yok.

**Öneri:** Kişisel veri içermeyen yerel bir diagnostic log, hata kategorileri ve “Tanı raporunu kopyala” özelliği ekleyin.

#### P3.5 - Depolama şeması ve migration mekanizması yok

Yeni sürümlerde storage yapısı değişirse eski kullanıcı verilerinin nasıl taşınacağı tanımlı değil.

**Öneri:** `schemaVersion` ekleyin ve idempotent migration fonksiyonları oluşturun.

## 4. Geliştirilebilecek ürün özellikleri

Bu bölüm, P0 ve P1 düzeltmelerinden sonra ele alınmalıdır.

### Yüksek değer / düşük-orta efor

- **Ön izleme ve seçim ekranı:** Önce adayları tara, kullanıcı seçsin, sonra açık onayla işle.
- **Gelişmiş whitelist:** Liste içe/dışa aktarma, not ekleme, oluşturulma tarihi, toplu ekleme.
- **Filtre kuralları:** Kelime hariç verified, takipçi sayısı, hesap yaşı, karşılıklı takip ve regex/AND-OR kuralları.
- **Çalışma özeti:** Gerçek unfollow, dry-run, whitelist, keyword, başarısız ve kalan aday sayıları.
- **Başarısız işlemleri yeniden dene:** Sınırlı retry ve hata nedeni gösterimi.
- **Duraklat/devam et:** Stop'tan ayrı, mevcut kuyruğu koruyan pause.
- **Ayar yedekleme:** Filtre, whitelist ve tercihleri JSON olarak dışa/içe aktarma.
- **Selector sağlık kontrolü:** X DOM'u değiştiğinde işlem yapmadan “bu sürüm desteklenmiyor” uyarısı.

### Orta-yüksek efor

- **Kural simülatörü:** Bir kuralın kaç kullanıcıyı koruyacağını dry-run sonuçları üzerinde gösterme.
- **Planlanmış manuel inceleme:** Otomatik unfollow yerine periyodik aday raporu ve kullanıcı onaylı temizlik.
- **Çoklu profil desteği:** Verileri X kullanıcı kimliğine göre namespace etmek; hesap değişince sayaçları karıştırmamak.
- **Bulut senkronizasyonu (opsiyonel):** Açık rıza, şifreleme ve ayrı gizlilik modeliyle whitelist/ayar senkronizasyonu.
- **Safari Web Extension:** macOS desteği için ortak çekirdeği platform adaptörlerinden ayırma.
- **Firefox uyumluluğu:** `chrome`/`browser` API adaptörü ve manifest farklarının yönetimi.

## 5. Önerilen hedef mimari

Mevcut kod tek dosyalarda çok sayıda sorumluluk taşıyor. Aşağıdaki modüler yapı bakım maliyetini düşürür:

```text
src/
  core/
    candidate-detector.js
    filter-engine.js
    run-state-machine.js
    limit-policy.js
    statistics.js
  platform/
    chrome-storage.js
    chrome-messaging.js
    gumroad-license.js
  x-adapter/
    selectors.js
    user-cell-parser.js
    following-page.js
    action-verifier.js
  popup/
    controllers/
    views/
  background/
  shared/
```

Temel ilke: filtreleme, limit ve istatistik mantığı saf JavaScript fonksiyonları olmalı; Chrome API ve X DOM erişimi adaptörlerin arkasında kalmalıdır. Böylece birim testi ve farklı masaüstü tarayıcılara uyarlama kolaylaşır.

## 6. Uygulama yol haritası

### Faz 1 - Stabilizasyon

- Sekme `hidden` hatasını düzeltin.
- Pro limitini gerçek motorla bağlayın.
- Undo metnini ve davranışını dürüst hale getirin.
- Rate-limit persistence ve pause mantığını düzeltin.
- Scroll/bitiş algoritmasını benzersiz kullanıcılar üzerinden yeniden yazın.
- Aksiyon sonrası başarı doğrulaması ekleyin.

**Çıkış kriteri:** Free/Pro limit, stop, dry-run, batch, scroll sonu ve sayfa yenileme senaryoları testlerle geçiyor.

### Faz 2 - Gizlilik ve yayın hazırlığı

- Veri envanteri çıkarın ve privacy policy'yi güncelleyin.
- Gerçek “tüm verileri sil” fonksiyonu ekleyin.
- Store listing, README ve UI metinlerini çalışan davranışla eşitleyin.
- X politika riskine göre ürün dilini ve otomasyon akışını değiştirin.
- Lisans doğrulama modelini sertleştirin.

**Çıkış kriteri:** Kod, manifest, mağaza açıklaması ve gizlilik beyanı birbiriyle tutarlı.

### Faz 3 - Test ve bakım altyapısı

- Lint/format/test komutları oluşturun.
- X DOM fixture testleri ekleyin.
- Playwright smoke testleri ve CI kurun.
- Storage migration ve sürüm otomasyonu ekleyin.

**Çıkış kriteri:** Her commit'te sözdizimi, lint, unit ve temel extension akışı otomatik doğrulanıyor.

### Faz 4 - Ürün büyümesi

- Ön izleme/seçim deneyimi.
- Gelişmiş filtreler ve çalışma raporu.
- Firefox/Safari adaptörleri.
- Kullanıcı onaylı, politika açısından daha sürdürülebilir temizlik akışı.

## 7. Önerilen başarı metrikleri

- Taranan benzersiz kullanıcı / toplam beklenen kullanıcı oranı
- Başarılı, başarısız ve belirsiz aksiyon oranı
- Yanlış aday bildirimi oranı
- Bir çalışmanın yarıda kalma oranı
- Selector uyumsuzluğu hata oranı
- Dry-run'dan onaylı işleme dönüşüm oranı
- Free -> Pro dönüşüm oranı
- Lisans doğrulama hata ve refund/expired senaryosu oranı
- Support talebi başına tanı koyma süresi

Bu metrikler kişisel veriyi merkezi olarak toplamadan da yerel çalışma özeti olarak üretilebilir. Telemetri eklenirse açık rıza, veri minimizasyonu ve güncel gizlilik politikası gerekir.

## 8. Sonuç

Proje, özellik açısından sıradan bir MVP'nin üzerinde; fakat güvenilir ürün olmasını engelleyen birkaç temel doğruluk ve beyan sorunu var. Şu aşamada yeni özellik eklemekten önce P0 sorunlarını çözmek en yüksek getiriyi sağlar. Özellikle Pro limiti, undo, scroll tamamlanma mantığı, rate-limit persistence ve gizlilik politikası düzeltilmeden ücretli veya geniş dağıtımlı yayın önerilmez.

Teknik olarak en doğru ürün yönü, “tam otomatik toplu unfollow” yerine güçlü analiz, dry-run, seçim ve açık kullanıcı onayı üzerine kurulmuş bir takip yönetimi yardımcısıdır. Bu yaklaşım mevcut filtre, istatistik ve lisans altyapısının çoğunu korurken platform ve kullanıcı hesabı riskini azaltır.
