import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchFreeGemini, resetFreeTierStop, isFreeTierStop } from '../src/free-tier.mjs';

const nativeFetch = globalThis.fetch;
const endpoint = model => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=test-only-key`;
afterEach(() => { globalThis.fetch = nativeFetch; resetFreeTierStop(); });

test('paid image models and IMAGE output never make a network request', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('{}'); };
  await assert.rejects(fetchFreeGemini(endpoint('gemini-2.5-flash-image')), isFreeTierStop);
  await assert.rejects(fetchFreeGemini(endpoint('gemini-2.5-flash'), {
    body: JSON.stringify({ generationConfig: { responseModalities: ['IMAGE'] } }),
  }), isFreeTierStop);
  assert.equal(calls, 0);
});

test('429 stops retries and subsequent text/TTS calls until explicit reset', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('{}', { status: 429 }); };
  await assert.rejects(fetchFreeGemini(endpoint('gemini-2.5-flash')), /kotas[ıi] doldu/);
  await assert.rejects(fetchFreeGemini(endpoint('gemini-2.5-flash-preview-tts')), isFreeTierStop);
  assert.equal(calls, 1);
  resetFreeTierStop();
  globalThis.fetch = async () => { calls++; return new Response('{}'); };
  assert.equal((await fetchFreeGemini(endpoint('gemini-2.5-flash'))).status, 200);
  assert.equal(calls, 2);
});

test('missing key is explained before any request', async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; };
  await assert.rejects(fetchFreeGemini(endpoint('gemini-2.5-flash').replace('test-only-key', '')), /anahtar/);
  assert.equal(called, false);
});

test('text and voice keep their payload while key moves out of the URL', async () => {
  const payload = JSON.stringify({ contents: [{ parts: [{ text: 'Merhaba Türkiye' }] }] });
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).searchParams.has('key'), false);
    assert.equal(options.headers.get('x-goog-api-key'), 'test-only-key');
    assert.equal(options.headers.get('Content-Type'), 'application/json');
    assert.equal(options.body, payload);
    return new Response('{"ok":true}');
  };
  for (const model of ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash-preview-tts']) {
    assert.equal((await fetchFreeGemini(endpoint(model), { method: 'POST', body: payload })).ok, true);
  }
});

test('Search survives the Gemini 2.5 JSON-mode compatibility change', async () => {
  const schema = { type: 'OBJECT', properties: { title: { type: 'STRING' } }, required: ['title'] };
  const payload = {
    contents: [{ parts: [{ text: 'Gazete başlığını oku' }] }],
    systemInstruction: { parts: [{ text: 'Yalnız kaynak metni kullan.' }] },
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema },
  };
  globalThis.fetch = async (_, options) => {
    const sent = JSON.parse(options.body);
    assert.deepEqual(sent.tools, payload.tools);
    assert.deepEqual(sent.contents, payload.contents);
    assert.equal(sent.generationConfig.responseSchema, undefined);
    assert.equal(sent.generationConfig.responseMimeType, undefined);
    assert.equal(sent.generationConfig.temperature, 0.2);
    assert.equal(sent.systemInstruction.parts[0].text, payload.systemInstruction.parts[0].text);
    assert.ok(sent.systemInstruction.parts[1].text.includes(JSON.stringify(schema)));
    return new Response('{}');
  };
  await fetchFreeGemini(endpoint('gemini-2.5-flash'), { method: 'POST', body: JSON.stringify(payload) });
  assert.deepEqual(payload.generationConfig.responseSchema, schema);
});
