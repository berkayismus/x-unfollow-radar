# X Unfollow Radar - Geliştirme Yol Haritası

**Başlangıç:** 26 Ağustos 2026

Bu belge, `URUN_VE_TEKNIK_ANALIZ_RAPORU.md` içindeki bulguları uygulanabilir fazlara ayırır. İşaretli maddeler geliştirilmiş, boş maddeler sıradaki işlerdir.

## Faz 1 - Stabilizasyon ve davranış doğruluğu

Amaç: Yanlış kullanıcı işlemi, yanlış sayaç, yarım kalan akış ve yanıltıcı arayüz risklerini gidermek.

### Paket 1A - Kritik doğruluk

- [x] Filtreler ve İstatistikler sekmelerindeki `hidden` yönetimini düzelt.
- [x] Free/Pro limitini tek bir `getSessionLimit()` kaynağından uygula.
- [x] Pro limitini content script otomasyon motoruna bağla.
- [x] “Undo” özelliğini gerçek davranışına uygun olarak “Profili aç ve manuel takip et” şeklinde değiştir.
- [x] Dry-run işlemlerini gerçek unfollow ve günlük limit sayacından ayır.
- [x] Dry-run istatistiğini ayrı `dryRun` alanında tut.
- [x] Yeni oturumda batch onay durumunu sıfırla.
- [x] Yanıltıcı “rate-limit safe” iddiasını kontrollü tempo ifadesiyle değiştir.

### Paket 1B - Otomasyon dayanıklılığı

- [x] Kayıtlı rate-limit süresini sayfa yenilemesinden sonra yeniden uygula.
- [x] Rate-limit beklemesini timestamp tabanlı ve yeniden zamanlanabilir yap.
- [x] Scroll bitiş kararını DOM kart sayısı yerine benzersiz kullanıcı büyümesine bağla.
- [x] Confirm sonrası buton durumunu kontrol ederek başarıyı doğrula.
- [x] X hata/toast/dialog içeriklerinden gerçek rate-limit algılama ekle.
- [x] `MutationObserver` ile yeni kart yüklenmesini bekleyen scroll adaptörü ekle.
- [x] Dialog'un hedef kullanıcıya ait olduğunu doğrula.
- [x] Stop işlemini `AbortController` ile gecikme ve tıklama zincirine uygula.
- [x] Ardışık başarısızlıklarda circuit breaker ve anlaşılır hata durumu ekle.

### Paket 1C - Sayaç ve çalışma durumu

- [ ] Güvenlik limitini kayan son-24-saat aksiyon kayıtlarından hesapla.
- [ ] Kullanıcı resetinin güvenlik limitini aşmasına izin verme.
- [ ] Çalışma durumunu `queued/attempting/succeeded/failed` durum makinesine taşı.
- [ ] Popup yeniden açıldığında son çalışma listesini geri yükle.
- [ ] Gerçek, dry-run, atlanan ve başarısız sonuçları ayrı çalışma özetinde göster.

**Faz 1 çıkış kriteri:** Free/Pro limit, stop, dry-run, batch, scroll sonu, başarısız aksiyon ve sayfa yenileme senaryoları otomatik testlerden geçer.

## Faz 2 - Gizlilik, lisans ve yayın hazırlığı

Amaç: Kod, ürün beyanı ve mağaza açıklamalarını aynı gerçeğe bağlamak.

- [x] Yerel ve harici veri işleme envanterini tamamla.
- [x] Gizlilik politikasında Gumroad aktarımını, kullanıcı adı geçmişini, whitelist'i ve saklama sürelerini açıkla.
- [x] “İstatistikleri sıfırla” ve gerçek “Tüm verileri sil” işlemlerini ayır.
- [x] README, Store Listing, popup ve manifest limit/özellik metinlerini eşitle.
- [x] Gereksiz `web_accessible_resources` kapsamını kaldır.
- [x] CSV escaping ve formül enjeksiyonu koruması ekle.
- [x] Lisans doğrulamasını 24 saatlik periyodik entitlement kontrolüyle güçlendir.
- [x] Refund, chargeback, dispute, subscription-ended, expired ve çevrimdışı lisans durumlarını tanımla.
- [x] Gumroad ürün kimliği doğrulandıktan sonra yeni ürünler için `product_permalink` yerine `product_id` kullan.
- [ ] X otomasyon politikasına uygun kullanıcı seçimli/onaylı ürün akışını yayın varsayılanı yap.

**Faz 2 çıkış kriteri:** Kod, manifest, mağaza metni ve gizlilik politikası birbiriyle tutarlıdır.

## Faz 3 - Test, CI ve bakım altyapısı

Amaç: X DOM değişikliklerini ve ürün regresyonlarını yayın öncesinde yakalamak.

- [x] Bağımlılıksız sözdizimi ve smoke test komutlarını ekle.
- [x] Free/Pro limit ve locale anahtar eşitliği regresyon testlerini ekle.
- [x] Gumroad aktivasyon, önbellek ve entitlement iptali regresyon testlerini ekle.
- [ ] ESLint ve Prettier yapılandırması ekle.
- [ ] UserCell fixture'larıyla filtre ve aday tespit testleri ekle.
- [ ] Playwright unpacked-extension smoke testleri ekle.
- [ ] GitHub Actions üzerinde test ve paket doğrulama akışı kur.
- [ ] Storage `schemaVersion` ve idempotent migration altyapısı ekle.
- [ ] Tek kaynaktan manifest/dosya sürümü üreten release komutu ekle.
- [ ] Kullanılmayan sabit ve state alanlarını temizle.

**Faz 3 çıkış kriteri:** Her değişiklikte syntax, lint, unit, DOM fixture ve temel extension akışı otomatik doğrulanır.

## Faz 4 - Ürün büyümesi ve tarayıcı genişlemesi

Amaç: Riski düşük, kullanıcı kontrollü ve platformdan bağımsız bir takip yönetimi ürünü oluşturmak.

- [ ] Aday ön izleme, çoklu seçim ve açık işlem onayı ekle.
- [ ] Gelişmiş filtre kuralları ve kural simülatörü geliştir.
- [ ] Whitelist/ayar JSON içe-dışa aktarma ekle.
- [ ] Çoklu X hesabı için verileri hesap kimliğine göre ayır.
- [ ] Ortak çekirdeği Chrome API ve X DOM adaptörlerinden ayır.
- [ ] Firefox WebExtension adaptörü oluştur.
- [ ] macOS için Safari Web Extension paketleme çalışmasını başlat.

**Faz 4 çıkış kriteri:** Ortak çekirdek en az iki tarayıcı hedefinde çalışır ve aday seçimi kullanıcı onayı olmadan hesap değişikliği yapmaz.
