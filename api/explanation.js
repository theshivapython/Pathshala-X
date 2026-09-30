// POST /api/explanation — turns a question (plus optional answer, files and follow-up
// questions) into a simple explanation, in the language the student picks.
// Runs as a Vercel serverless function, and locally via `npm start` (see server.js).

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';
const TIMEOUT_MS = 45000;

const LIMITS = {
  question: 2000,
  answer: 4000,
  turn: 6000,
  turns: 12,
  files: 3,
  fileBytes: 3.5 * 1024 * 1024, // per file, base64 data URL length
  totalBytes: 4 * 1024 * 1024, // Vercel caps request bodies at 4.5 MB
  textFile: 20000,
};

const LEVELS = {
  simple: 'The learner is a complete beginner. Use very short sentences, everyday words and a relatable real-life analogy.',
  student: 'The learner is a school student. Be clear and friendly, define any technical term the first time you use it.',
  exam: 'The learner is revising for an exam. Be concise and precise: key facts, formulas and one worked example if useful.',
};

function languageRule(language) {
  if (!language || /^english$/i.test(language)) return 'Reply in English.';
  return [
    `Write the ENTIRE reply in ${language}, using its native script, even if the question or files are in another language.`,
    'Keep numbers, formulas and units in standard notation.',
    'The first time you use a technical term, add the English term in brackets.',
    `Translate the "In one line:" label into ${language} too.`,
  ].join(' ');
}

function systemPrompt({ level, language }) {
  return [
    'You are Pathshala-X, a patient and encouraging tutor for school students.',
    LEVELS[level] || LEVELS.student,
    'Explain the idea step by step. Format with short paragraphs and "-" bullet or "1." numbered lists; use **bold** for key terms.',
    'Do not use tables, LaTeX or code blocks. Write formulas in plain text (e.g. a^2 + b^2 = c^2).',
    'If attached images or documents contain the question, read them carefully and explain what they ask.',
    'If the provided answer is wrong or incomplete, gently say so and give the correct explanation.',
    'For follow-up questions, answer exactly what the student asks next, building on your earlier explanation.',
    'Finish with a line starting with "**In one line:**" that summarises the idea.',
    'Keep the whole reply under 300 words.',
    languageRule(language),
  ].join(' ');
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

/** Validates attachments and converts them into chat-completion content parts. */
function attachmentParts(raw) {
  if (raw === undefined || raw === null) return { parts: [], textBlocks: [] };
  if (!Array.isArray(raw)) return { error: 'Attachments must be a list.' };
  if (raw.length > LIMITS.files) return { error: `You can attach up to ${LIMITS.files} files.` };

  const parts = [];
  const textBlocks = [];
  let total = 0;
  for (const file of raw) {
    const name = String(file?.name ?? 'file').slice(0, 120);
    const type = String(file?.type ?? '');
    if (typeof file?.text === 'string') {
      total += file.text.length;
      textBlocks.push(`--- File: ${name} ---\n${file.text.slice(0, LIMITS.textFile)}`);
      continue;
    }
    const data = String(file?.data ?? '');
    total += data.length;
    if (data.length > LIMITS.fileBytes) return { error: `"${name}" is too large. Please use a smaller file.` };
    if (/^image\/(png|jpe?g|webp|gif)$/.test(type) && data.startsWith(`data:${type};base64,`)) {
      parts.push({ type: 'image_url', image_url: { url: data, detail: 'auto' } });
    } else if (type === 'application/pdf' && data.startsWith('data:application/pdf;base64,')) {
      parts.push({ type: 'file', file: { filename: name, file_data: data } });
    } else {
      return { error: `"${name}" is not a supported file. Use a photo, PDF or text file.` };
    }
  }
  if (total > LIMITS.totalBytes) return { error: 'Your files are too large together. Please attach fewer or smaller files.' };
  return { parts, textBlocks };
}

/** Follow-ups: [assistant, user, assistant, user, ...] ending with a user turn. */
function followUpMessages(raw) {
  if (raw === undefined || raw === null) return { messages: [] };
  if (!Array.isArray(raw) || raw.length > LIMITS.turns) return { error: 'This conversation is too long. Please start a new question.' };
  const messages = [];
  for (let i = 0; i < raw.length; i++) {
    const expected = i % 2 === 0 ? 'assistant' : 'user';
    const content = String(raw[i]?.content ?? '').trim();
    if (raw[i]?.role !== expected || !content) return { error: 'Invalid conversation history.' };
    if (content.length > LIMITS.turn) return { error: 'A message in this conversation is too long.' };
    messages.push({ role: expected, content });
  }
  if (messages.length && messages[messages.length - 1].role !== 'user') {
    return { error: 'Invalid conversation history.' };
  }
  return { messages };
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
  const language = String(body.language ?? 'English').replace(/[^\p{L}\p{M}\s()\-]/gu, '').trim().slice(0, 40) || 'English';

  const files = attachmentParts(body.attachments);
  if (files.error) return res.status(400).json({ error: files.error });
  const followUps = followUpMessages(body.followUps);
  if (followUps.error) return res.status(400).json({ error: followUps.error });

  if (!question && !files.parts.length && !files.textBlocks.length) {
    return res.status(400).json({ error: 'Please type a question or attach a file.' });
  }
  if (question.length > LIMITS.question || answer.length > LIMITS.answer) {
    return res.status(400).json({ error: 'Your question or answer is too long. Please shorten it.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI service not configured', code: 'NO_API_KEY' });
  }

  const firstText = [
    subject && subject !== 'General' ? `Subject: ${subject}` : null,
    question ? `Question: ${question}` : 'Question: Please explain the question in the attached file(s).',
    answer ? `Answer given: ${answer}` : 'No answer was given — explain how to answer the question.',
    ...files.textBlocks,
  ].filter(Boolean).join('\n');

  const messages = [
    { role: 'system', content: systemPrompt({ level, language }) },
    { role: 'user', content: files.parts.length ? [{ type: 'text', text: firstText }, ...files.parts] : firstText },
    ...followUps.messages,
  ];

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
        messages,
        temperature: 0.4,
        max_tokens: 1200,
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
