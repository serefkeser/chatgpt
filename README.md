# OTONOM — GitHub Pages

Yüklenen `Chatgpt_1.44.tsx` uygulamasının statik web sürümü. Gazete/görsel yükleme, metin analizi, ses, altyazı, kapak ve tarayıcıda video işleme akışı korunur. React, Tailwind ve video dönüştürme motoru birlikte derlenir; sunucu kiralamak gerekmez.

Hedef adres: **https://serefkeser.github.io/chatgpt/**

## İlk yayın

1. [Settings → Pages](https://github.com/serefkeser/chatgpt/settings/pages) sayfasını açın.
2. **Build and deployment → Source → GitHub Actions** seçin.
3. [Actions](https://github.com/serefkeser/chatgpt/actions/workflows/pages.yml) sayfasında **Test and publish GitHub Pages → Run workflow → main** seçin. Sonraki `main` güncellemeleri otomatik yayınlanır.

Bağlı GitHub aracı Pages yönetim ayarını değiştiremiyor. Bu seçim yapılmadıysa ilk yayın için gereklidir. Kaynağın GitHub'da bulunması, sitenin yayında olduğunu tek başına göstermez.

## Ücretsiz kullanım

- Herkese açık depo için GitHub Pages ücretsizdir; ücretli sunucu veya özel alan adı gerekmez.
- AI görsel API'leri kapalıdır. Yüklediğiniz gazete/görseller sahnelerde kullanılır; görsel yoksa tarayıcıda yerel arka plan çizilir.
- Metin/OCR: `gemini-2.5-flash`, gerektiğinde `gemini-2.5-flash-lite`. Ses: mevcut `gemini-2.5-flash-preview-tts`.
- Metin ve ses **sınırsız değildir**. Faturalandırması kapalı Gemini projesinin anahtarını kullanın. Site hesabınızın ücretli olup olmadığını anahtardan okuyamaz; ücretli projeye ait anahtarda Google ücretlendirebilir.
- 429 kotasında yeni Gemini çağrıları durur; ücretli modele geçilmez. Kota yenilendiğinde anahtar penceresindeki **Kaydet** düğmesiyle tekrar deneyebilirsiniz.

Resmi koşullar: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Gemini fiyatlandırması](https://ai.google.dev/gemini-api/docs/pricing). Model/kota bilgileri 16 Eylül 2026'da kontrol edildi.

## Kullanım

1. **Metin ve ses anahtarı** düğmesinden kendi Gemini anahtarınızı girin. Anahtar yalnız bu sekmenin oturumunda saklanır; depoya ve derlemeye eklenmez.
2. Gazete/görselinizi **Medya yükle** alanına ekleyin. İsterseniz sabit görsel ve müzik klasörünüzü seçin.
3. Dil, ses, altyazı ve MP4 ayarlarını seçip **Video oluştur** düğmesine basın. Sekmeyi açık tutun.
4. Videoyu indirin. Otomatik indirme engellenirse ekrandaki indirme düğmesini kullanın.

Müzikler ve ayarlar o tarayıcıda tutulur. Telefonlarda klasör erişimi tarayıcıya göre değişebilir. Uzun/yüksek çözünürlüklü videolar cihazın işlemci ve belleğini kullanır.

Gazete sitelerinden doğrudan alma, kaynak sitenin CORS/erişim koşullarına bağlıdır; çalışmazsa gazete görselini yükleyebilirsiniz. Buffer/LinkedIn otomasyonu yerel köprü/eklenti gerektirir; Pages Python/Node servisi çalıştırmaz. Otomatik paylaşım ve 07:00 işlemi ilk açılışta kapalıdır. Zamanlama ancak sayfa açıkken çalışır.

## Geliştirme ve test

Node.js 22.12+ veya 24:

```sh
npm ci
npm run dev
```

Yerel adres: `http://127.0.0.1:5173/chatgpt/`

```sh
npm test
npm run build
npx playwright install --with-deps firefox
npm run test:browser
```

`dist/` yayın çıktısıdır. `/chatgpt/` alt yolu yapılandırılmıştır. FFmpeg gerektiğinde aynı siteden yüklenir ve SharedArrayBuffer gerektirmez.

Testler API korumalarını, mobil arayüzü, sekme içi anahtarı ve gerçek WebM → H.264/AAC MP4 dönüşümünü kapsar. Canlı Gemini metin/OCR/TTS üretimi kullanıcı anahtarı olmadan test edilmedi.

[Değişiklikler](CHANGELOG.md) · [Araçların kurulum durumu](docs/HAZIRLIK_DURUMU.md)
