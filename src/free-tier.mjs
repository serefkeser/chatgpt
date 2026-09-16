// This allowlist limits features, not the billing tier of a Google account.
// Use a Gemini project with billing disabled. Reviewed 2026-09-16.
export const FREE_MODELS = Object.freeze([
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash-preview-tts',
]);

let stopped = null;
export const isFreeTierStop = error => error?.code === 'FREE_TIER_STOP';
export const resetFreeTierStop = () => { stopped = null; };
export const assertFreeTierAvailable = () => { if (stopped) throw stopped; };

function stop(message) {
  const error = new Error(`HTTP_FAIL_FREE: ${message}`);
  error.code = 'FREE_TIER_STOP';
  return error;
}

export function prepareGeminiPayload(payload) {
  // Gemini 2.5 cannot combine built-in tools with schema-constrained output.
  // Keep Search and request the same JSON shape in the instruction instead.
  if (!payload.tools?.length || !payload.generationConfig?.responseSchema) return payload;
  const { responseSchema, responseMimeType, ...generationConfig } = payload.generationConfig;
  return {
    ...payload,
    generationConfig,
    systemInstruction: {
      ...payload.systemInstruction,
      parts: [
        ...(payload.systemInstruction?.parts || []),
        { text: `Yanıtı yalnız geçerli JSON olarak ver; Markdown ekleme. Bu şemadaki alanları ve zorunlu alanları kullan: ${JSON.stringify(responseSchema)}` },
      ],
    },
  };
}

export async function fetchFreeGemini(url, options = {}) {
  assertFreeTierAvailable();
  const parsed = new URL(url);
  const model = parsed.pathname.match(/^\/v1beta\/models\/([^/:]+):generateContent$/)?.[1];
  if (parsed.origin !== 'https://generativelanguage.googleapis.com' || !FREE_MODELS.includes(model)) {
    throw stop('Bu model ücretsiz sürümde kapalı. Ücretli sağlayıcıya geçilmedi.');
  }
  const key = parsed.searchParams.get('key')?.trim();
  if (!key) throw stop('Metin ve ses için API anahtarınızı ekleyin. Faturalandırması kapalı Gemini projesi kullanın.');
  const payload = JSON.parse(options.body || '{}');
  if (payload.generationConfig?.responseModalities?.includes('IMAGE')) {
    throw stop('AI görsel üretimi kapalı. Kendi gazete veya görselinizi yükleyin.');
  }
  // Keep the key out of the URL, browser history and server URL logs.
  parsed.searchParams.delete('key');
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('x-goog-api-key', key);
  const compatiblePayload = prepareGeminiPayload(payload);
  const response = await fetch(parsed.href, {
    ...options, headers,
    body: compatiblePayload === payload ? options.body : JSON.stringify(compatiblePayload),
  });
  if (response.status === 429) {
    stopped = stop('Gemini kotası doldu (429). İşlem durduruldu; ücretli modele geçilmedi. Kotanız yenilendiğinde anahtar ayarından Kaydet ile tekrar deneyebilirsiniz.');
    throw stopped;
  }
  if ([400, 401, 403, 404].includes(response.status)) {
    throw stop(`Gemini isteği reddedildi (${response.status}). Anahtar, model erişimi ve ücretsiz proje ayarlarını kontrol edin.`);
  }
  return response;
}

export function sourceImages(state) {
  const custom = (state.config?.customSceneImages || []).filter(Boolean);
  const uploaded = state.inputType === 'media' && Array.isArray(state.inputData)
    ? state.inputData.filter(item => item?.type?.startsWith('image/') && item.data).map(item => item.data)
    : [];
  return custom.length ? custom : uploaded;
}

export function imageForBlock(block, customImages, index) {
  return block.customImage || customImages[index] || null;
}
