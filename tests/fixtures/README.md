# Teknik medya örneği

sample.webm, kullanıcı verisi içermeyen 1,5 saniyelik renk/desen ve 440 Hz ton örneğidir. Gerçek VP8/Opus girdisinin tarayıcıdaki FFmpeg ile H.264/AAC çıktısına dönüşümü test edilir.

Yeniden üretme:

```sh
ffmpeg -f lavfi -i testsrc2=size=180x320:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 1.5 -c:v libvpx -b:v 200k -c:a libopus -y tests/fixtures/sample.webm
```
