# Değişiklik kaydı

## 1.44.1 — GitHub Pages, 16 Eylül 2026

- React/Vite/Tailwind derlemesi, /chatgpt/ alt yolu ve GitHub Actions test/yayın akışı eklendi.
- Ücretli AI görsel üretimi kaldırıldı; yüklenen görseller tüm sahnelerde kullanılır. Eksik görsel için yerel arka plan açıkça bildirilir.
- Eski metin/OCR model kimlikleri Gemini 2.5 ücretsiz katmanlı modellerle değiştirildi. Mevcut TTS modeli ve ses seçimi korundu.
- 429 kotasında otomatik tekrar/sonraki çağrılar durduruldu; anahtar/erişim hataları sessizce yutulmaz.
- Gemini 2.5 Search/JSON uyumsuzluğu giderildi; arama ve beklenen alanlar korundu.
- Anahtar sekme oturumuna taşındı; kullanılmayan proxy bilgisi kaldırıldı.
- FFmpeg aynı siteden yüklenir; tek iş parçacığı ve gerçek 30 FPS doğrulaması korundu.
- 07:00 ve Buffer otomatik işlemleri ilk açılışta kapalı. Kullanılmayan Buffer anahtar alanı yerine köprü gereksinimi açıklandı.
- Telefonda müzik düğmesi taşması ve kaynak/yorum alanlarının sıkışması düzeltildi.
- Vercel skills/find-skills eklendi; PDF'deki geliştirme araçlarının gerçek durumu belgelendi.

Doğrulama: 5 API koruma testi, 3 Firefox testi, gerçek H.264/AAC MP4 ve 30 FPS kontrolü. Canlı Gemini üretimi kullanıcı anahtarı olmadan doğrulanmadı.
