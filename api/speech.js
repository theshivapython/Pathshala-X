// POST /api/speech — reads text aloud with a natural AI voice in any language.
// Returns audio/mpeg. The browser falls back to the device's own voices when this
// endpoint is unavailable (e.g. no OPENAI_API_KEY).

const OPENAI_URL = 'https://api.openai.com/v1/audio/speech';
const DEFAULT_MODEL = 'gpt-4o-mini-tts';
const DEFAULT_VOICE = 'alloy';
const MAX_CHARS = 4000;
const TIMEOUT_MS = 45000;

function readBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = null;
    }
  }
  return body && typeof body === 'object' ? body : {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const body = readBody(req);
  const text = String(body.text ?? '').trim();
  const language = String(body.language ?? '').replace(/[^\p{L}\p{M}\s()\-]/gu, '').trim().slice(0, 40);

  if (!text) return res.status(400).json({ error: 'Nothing to read aloud.' });
  if (text.length > MAX_CHARS) return res.status(400).json({ error: 'This text is too long to read aloud.' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI voice not configured', code: 'NO_API_KEY' });

  const model = process.env.OPENAI_TTS_MODEL || DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const aiRes = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        voice: process.env.OPENAI_TTS_VOICE || DEFAULT_VOICE,
        input: text,
        response_format: 'mp3',
        // Only the gpt-4o TTS models accept style instructions.
        ...(model.startsWith('gpt-') ? {
          instructions: `Speak like a warm, patient teacher, clearly and at a calm pace${language ? `, in ${language}` : ''}.`,
        } : {}),
      }),
      signal: controller.signal,
    });

    if (!aiRes.ok) {
      const data = await aiRes.json().catch(() => null);
      console.error(`OpenAI TTS error ${aiRes.status}: ${data?.error?.message || aiRes.statusText}`);
      return res.status(aiRes.status === 429 ? 429 : 502).json({ error: 'The AI voice service returned an error.' });
    }

    const audio = Buffer.from(await aiRes.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(audio.length));
    res.setHeader('Cache-Control', 'no-store');
    return res.end(audio);
  } catch (error) {
    const timedOut = error.name === 'AbortError';
    console.error('Speech request failed:', error);
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'The AI voice took too long to respond.' : 'Could not reach the AI voice service.',
    });
  } finally {
    clearTimeout(timer);
  }
}
