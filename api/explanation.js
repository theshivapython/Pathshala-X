// POST /api/explanation — turns a question (and optional answer) into a simple explanation.
// Runs as a Vercel serverless function, and locally via `npm start` (see server.js).

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';
const TIMEOUT_MS = 25000;

const LEVELS = {
  simple: 'The learner is a complete beginner. Use very short sentences, everyday words and a relatable real-life analogy.',
  student: 'The learner is a school student. Be clear and friendly, define any technical term the first time you use it.',
  exam: 'The learner is revising for an exam. Be concise and precise: key facts, formulas and one worked example if useful.',
};

function buildMessages({ question, answer, subject, level }) {
  const system = [
    'You are Pathshala-X, a patient and encouraging tutor for school students.',
    LEVELS[level] || LEVELS.student,
    'Explain the idea step by step. Format with short paragraphs and "-" bullet or "1." numbered lists; use **bold** for key terms.',
    'Do not use tables, LaTeX or code blocks. Write formulas in plain text (e.g. a^2 + b^2 = c^2).',
    'If the provided answer is wrong or incomplete, gently say so and give the correct explanation.',
    'Finish with a line starting with "**In one line:**" that summarises the idea.',
    'Keep the whole reply under 250 words.',
  ].join(' ');

  const user = [
    subject && subject !== 'General' ? `Subject: ${subject}` : null,
    `Question: ${question}`,
    answer ? `Answer given: ${answer}` : 'No answer was given — explain how to answer the question.',
  ].filter(Boolean).join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

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
  const question = String(body.question ?? '').trim();
  const answer = String(body.answer ?? '').trim();
  const subject = String(body.subject ?? '').trim().slice(0, 60);
  const level = String(body.level ?? 'student');

  if (!question) {
    return res.status(400).json({ error: 'Please provide a question.' });
  }
  if (question.length > 2000 || answer.length > 4000) {
    return res.status(400).json({ error: 'Your question or answer is too long. Please shorten it.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI service not configured', code: 'NO_API_KEY' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const aiRes = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        messages: buildMessages({ question, answer, subject, level }),
        temperature: 0.4,
        max_tokens: 600,
      }),
      signal: controller.signal,
    });

    const data = await aiRes.json().catch(() => null);

    if (!aiRes.ok) {
      const detail = data?.error?.message || aiRes.statusText;
      console.error(`OpenAI error ${aiRes.status}: ${detail}`);
      const status = aiRes.status === 429 ? 429 : 502;
      return res.status(status).json({
        error: status === 429 ? 'The AI service is busy. Please try again shortly.' : 'The AI service returned an error.',
      });
    }

    const explanation = data?.choices?.[0]?.message?.content?.trim();
    if (!explanation) {
      return res.status(502).json({ error: 'The AI service returned an empty response.' });
    }

    return res.status(200).json({ explanation });
  } catch (error) {
    const timedOut = error.name === 'AbortError';
    console.error('Explanation request failed:', error);
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'The AI service took too long to respond.' : 'Could not reach the AI service.',
    });
  } finally {
    clearTimeout(timer);
  }
}
