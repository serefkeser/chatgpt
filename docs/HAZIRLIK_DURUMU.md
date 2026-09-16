# Kurulum ve doğrulama durumu

16 Eylül 2026. Kullanıcı GitHub Pages hazırlığını, Vercel skills kurulumunu ve ücretli AI görsellerin yerine yüklenen görsellerin kullanılmasını açıkça onayladı.

## Araçlar

Kurulumlar bu çalışmanın geliştirme ortamında yapıldı; kullanıcının Windows bilgisayarına uzaktan kurulmadı. Bunlar GitHub Pages üzerinde çalışan sunucu hizmetleri değildir.

| Araç | Doğrulanan durum | Kullanım / sınır |
| --- | --- | --- |
| Playwright CLI 0.1.20 / Playwright 1.62.1 | CLI kurulu, Firefox 153 indirildi. | Mobil, anahtar, 429 ve gerçek MP4 testleri. |
| Vercel skills 1.5.26 | CLI ve resmi find-skills becerisi kuruldu; skills list doğrulandı. | Proje becerilerinin envanteri alındı. |
| claude-mem 13.25.1 | Bun 1.4.2 ve Codex CLI 0.154.0 ile yerel Codex eklentisi kaydedildi. | Worker health: ok. Kapsam kararı kaydedilip geri okundu. Otomatik Work sohbet kaydı bağlı değil. |
| OmniRoute 3.8.50 | Paket, sürüm ve yardım komutları çalışıyor. | Sağlayıcı hesabı bağlanmadı; bu sohbetin trafiği yönlendirilmedi. |
| Headroom 0.37.0 | Ayrı Python ortamında headroom-ai[proxy] kurulu. | headroom sg: orijinalde 24, Pages uygulamasında 23 doğrudan fetch. Proxy/tasarruf ölçümü etkin değil. |
| Frontend Design | Resmi Anthropic becerisi projede. | Mevcut stüdyo görünümü korundu; açıklamalar, mobil taşma ve odak görünürlüğü kontrol edildi. |
| Claude Code Setup | claude-automation-recommender kurulu. | Projeye uygun otomasyon olarak test, derleme ve Pages yayını seçildi. |
| Task Observer | Resmi beceri, referanslar ve betikler projede. | Sürekli gözlem/otomatik tetikleme doğrulanmadı. |

claude-mem host kurulumu 37777/37778 üzerinde mevcut observer bekliyor; Work ortamında bu bağlantı yok. Ücretli servis/Pro deneme hesabı açılmadı. Telemetri kapatıldı. Manuel hafıza testinde SQLite kullanıldı, Chroma ve transkript izleme kapatıldı. Ortam yenilenirse paketler yeniden kurulmalıdır; Git'teki beceriler ve tarif kalır.

## Tekrarlanabilir kurulum

Uygulamadan ayrı geliştirici araçları:

```sh
npm install --prefix .dev-tools skills@1.5.26 @playwright/cli@0.1.20 claude-mem@13.25.1 @openai/codex@0.154.0 omniroute@3.8.50
npx --prefix .dev-tools skills add vercel-labs/skills --skill find-skills --agent codex --yes --copy
python -m venv .dev-tools/headroom
```

Oluşturulan Python ortamında `pip install "headroom-ai[proxy]==0.37.0"` kullanılır. claude-mem için [resmi kurulum](https://docs.claude-mem.ai/installation) ve yerel IDE'nin bağlantı adımları izlenir; otomatik kayıt ayrıca doğrulanır.

## Kaynak ve değişiklik sınırı

- Orijinal Chatgpt_1.44.tsx: 9.002 satır, 3.400.186 bayt.
- SHA-256: `038be5948280ed1ccc95e5d9e0be16631a1228cea0b67d0809b332c0aa827960`.
- Gövde src/App.tsx içinde korundu. Gömülü PNG aynı baytlarla public/assets/fixed-clickbait.png dosyasına ayrıldı.
- Kullanılmayan sabit proxy tokenı kaldırıldı. Gemini anahtarı sekme oturumunda ve HTTP başlığında taşınır; URL'ye gönderilmez.
- Gemini 2.5 Search/JSON kısıtı nedeniyle Search korundu, JSON şeması görev talimatına taşındı. Yanıt JSON olarak ayrıştırılır; geçersiz yanıt başarı sayılmaz.
- Kaynakta Buffer token alanı yalnız depolama yapıyor, köprüye aktarılmıyordu. Alan yerine Pages/köprü açıklaması eklendi.
- Yüklenen görseller tüm ilgili sahnelere atanır. Ücretli görsel uç noktası/model geçişi yoktur.

## Test kanıtı

- Derleme başarılı; JavaScript yaklaşık 433 KB, gzip yaklaşık 137 KB. Medya motoru gerektiğinde ayrı yüklenir.
- 5 API koruma testi ve 3 Firefox tarayıcı testi geçti.
- Gerçek çıktı ffprobe ile okundu: H.264 180×320, 30/1 FPS; video 1,500 saniye, AAC ses 1,528 saniye.
- Bu kısa teknik örnektir; tam haber videosu veya canlı Gemini TTS testi değildir. Kota testi taklit cevapla yapıldı; gerçek hesaptan kota/ücret tüketilmedi.
- Mobil ekran görüntüsünde taşan müzik düğmesi düzeltildi; ekran sınırında kaldığı test edilir.
- Başlangıçtaki tarayıcı testinde seçici doğru sekmeye taşındı. Test ortamının ses cihazı bağımlılığı ayrılarak MP4 dönüşümünde gerçek WebM örneği kullanıldı.
- Pages yönetim API'si bağlı GitHub aracında yoktur. İlk yayın için Settings → Pages → GitHub Actions seçimi gerekir. Canlı yayın ayrıca doğrulanır.

## Resmi kaynaklar

[Vercel skills](https://github.com/vercel-labs/skills), [Playwright](https://github.com/microsoft/playwright), [Playwright CLI](https://github.com/microsoft/playwright-cli), [claude-mem](https://docs.claude-mem.ai/installation), [OmniRoute](https://github.com/diegosouzapw/OmniRoute), [Headroom](https://github.com/headroomlabs-ai/headroom), [Anthropic eklentileri](https://github.com/anthropics/claude-plugins-official), [Task Observer](https://github.com/rebelytics/one-skill-to-rule-them-all).

[Gemini fiyatlandırması](https://ai.google.dev/gemini-api/docs/pricing), [model ömrü](https://ai.google.dev/gemini-api/docs/deprecations), [JSON/araç uyumu](https://ai.google.dev/gemini-api/docs/structured-output), [Pages etkinleştirme yetkisi](https://github.com/actions/configure-pages/blob/main/action.yml).
