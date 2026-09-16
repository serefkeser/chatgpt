import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('Pages path, mobile layout and tab-only key storage', async ({ page }) => {
  const errors = [];
  const aiRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('generativelanguage.googleapis.com')) aiRequests.push(request.url()); });
  await page.goto('./');
  await expect(page.getByText('Ücretsiz yayın · kendi görselleriniz.')).toBeVisible();
  await page.getByRole('button', { name: 'Gazete Takip', exact: true }).click();
  await expect(page.getByRole('button', { name: /07:00 KAPALI/ })).toBeVisible();
  await page.getByRole('button', { name: 'Medya Analizi', exact: true }).click();
  await page.getByRole('button', { name: /Metin ve ses anahtarı/ }).click();
  await page.getByLabel('Google Gemini API anahtarı').fill('test-only-key');
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('GEMINI_API_KEY'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('OTONOM_GEMINI_API_KEY'))).toBe('test-only-key');
  await page.reload();
  await expect(page.getByRole('button', { name: /Key:/ })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const musicButton = await page.getByRole('button', { name: 'MÜZİK KLASÖRÜ SEÇ', exact: true }).boundingBox();
  expect(musicButton.x).toBeGreaterThanOrEqual(0);
  expect(musicButton.x + musicButton.width).toBeLessThanOrEqual(390);
  await expect(page.getByText('Ücretsiz yayın · kendi görselleriniz.')).toBeVisible();
  expect(errors).toEqual([]);
  expect(aiRequests).toEqual([]);
  await page.screenshot({ path: 'test-results/pages-mobile.png', fullPage: true });
});

test('quota propagates through existing TTS retries without paid fallback', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/chatgpt/');
  await page.getByRole('button', { name: /Metin ve ses anahtarı/ }).click();
  await page.getByLabel('Google Gemini API anahtarı').fill('test-only-key');
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  let requests = 0;
  await page.route('https://generativelanguage.googleapis.com/**', route => {
    requests++;
    return route.fulfill({ status: 429, contentType: 'application/json', body: '{"error":{"message":"test quota"}}' });
  });
  const message = await page.evaluate(async () => {
    const { MediaSynthesisService } = await import('/chatgpt/src/App.tsx');
    try { await MediaSynthesisService.generateAudio('Bu bir ücretsiz kota testidir.', 'Kore', 'tr'); }
    catch (error) { return error.message; }
    return 'unexpected success';
  });
  expect(message).toContain('kotası doldu');
  expect(requests).toBe(1);
});

test('local image output and actual single-thread MP4 encoding', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/chatgpt/');
  await page.getByRole('button', { name: 'Medya Analizi', exact: true }).click();
  page.on('console', message => { if (message.text().startsWith('media-test:')) console.log(message.text()); });
  const external = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1')) external.push(request.url()); });
  const result = await page.evaluate(async () => {
    const { MediaSynthesisService, convertWebMtoMP4, _verifyInstagramCfrMp4 } = await import('/chatgpt/src/App.tsx');
    const image = await MediaSynthesisService.generateImage('Bir gazete arka planı', 'cinematic');
    const input = await (await fetch('/chatgpt/tests/fixtures/sample.webm')).blob();
    const mp4 = await convertWebMtoMP4(input);
    const checked = await _verifyInstagramCfrMp4(mp4); console.log('media-test: MP4 encoded and CFR checked');
    const bytes = new Uint8Array(await mp4.arrayBuffer());
    const url = URL.createObjectURL(mp4);
    const video = document.createElement('video'); video.src = url;
    await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = () => reject(new Error('Encoded MP4 cannot be played')); });
    const duration = video.duration; URL.revokeObjectURL(url);
    return { image: image.startsWith('data:image/'), size: bytes.length, signature: String.fromCharCode(...bytes.slice(4, 8)), fps: checked.fps, duration, encoded: btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')) };
  });
  await writeFile('test-results/encoded.mp4', Buffer.from(result.encoded, 'base64'));
  expect(result.image).toBe(true);
  expect(result.signature).toBe('ftyp');
  expect(result.size).toBeGreaterThan(1000);
  expect(result.fps).toBeCloseTo(30, 2);
  expect(result.duration).toBeGreaterThan(1);
  expect(result.duration).toBeLessThan(3);
  expect(external.filter(url => /generativelanguage|unpkg/.test(url))).toEqual([]);
});
