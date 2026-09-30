/* Ask AI page: calls /api/explanation, with a built-in offline fallback. */
document.addEventListener('DOMContentLoaded', () => {
  const { esc } = PX;
  const lessons = window.PX_LESSONS || [];
  const HISTORY_LIMIT = 30;

  const form = document.getElementById('askForm');
  const subjectEl = document.getElementById('subject');
  const levelEl = document.getElementById('level');
  const questionEl = document.getElementById('question');
  const answerEl = document.getElementById('answer');
  const submitBtn = document.getElementById('submitBtn');
  const formError = document.getElementById('formError');
  const output = document.getElementById('output');
  const notice = document.getElementById('notice');
  const actions = document.getElementById('outputActions');
  const speakBtn = document.getElementById('speakBtn');
  const copyBtn = document.getElementById('copyBtn');
  const historyEl = document.getElementById('history');
  const clearHistoryBtn = document.getElementById('clearHistory');

  let currentText = '';
  let busy = false;

  // ---------- Setup ----------
  subjectEl.innerHTML = ['General', ...PX.getSubjects().map((s) => s.name)]
    .map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');

  const presetSubject = PX.param('subject');
  if (presetSubject && [...subjectEl.options].some((o) => o.value === presetSubject)) {
    subjectEl.value = presetSubject;
  }
  const presetQuestion = PX.param('q');
  if (presetQuestion) questionEl.value = presetQuestion.slice(0, 2000);

  // ---------- Rendering ----------
  /** Minimal, safe markdown: paragraphs, bullet/numbered lists, **bold**, `code`, ### headings. */
  function renderMarkdown(text) {
    const inline = (s) => esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
    const lines = text.replace(/\r/g, '').split('\n');
    let html = '';
    let list = null;
    const closeList = () => {
      if (list) { html += `</${list}>`; list = null; }
    };
    lines.forEach((raw) => {
      const line = raw.trim();
      const bullet = line.match(/^[-*•]\s+(.*)$/);
      const numbered = line.match(/^\d+[.)]\s+(.*)$/);
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      if (bullet || numbered) {
        const type = bullet ? 'ul' : 'ol';
        if (list !== type) { closeList(); html += `<${type}>`; list = type; }
        html += `<li>${inline((bullet || numbered)[1])}</li>`;
      } else if (!line) {
        closeList();
      } else if (heading) {
        closeList();
        html += `<p><strong>${inline(heading[1])}</strong></p>`;
      } else {
        closeList();
        html += `<p>${inline(line)}</p>`;
      }
    });
    closeList();
    return html;
  }

  function plainText(text) {
    return text.replace(/\*\*|`|^#+\s*/gm, '').replace(/^[-*•]\s+/gm, '');
  }

  function showLoading() {
    notice.innerHTML = '';
    actions.hidden = true;
    output.innerHTML = '<div class="typing"><span class="dots" aria-hidden="true"><span></span><span></span><span></span></span> The tutor is thinking…</div>';
  }

  function showResult(entry) {
    currentText = entry.explanation;
    output.innerHTML = renderMarkdown(entry.explanation);
    actions.hidden = false;
    notice.innerHTML = entry.source === 'offline'
      ? `<div class="notice"><span aria-hidden="true">📴</span><span>The AI service isn't reachable right now${entry.reason ? ` (${esc(entry.reason)})` : ''}, so this is a built-in explanation. Set <code>OPENAI_API_KEY</code> on the server for full AI answers.</span></div>`
      : '';
    stopSpeaking();
  }

  // ---------- API ----------
  async function fetchExplanation(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch('/api/explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      let data = null;
      try { data = await res.json(); } catch (e) { /* non-JSON (e.g. static host 404) */ }
      if (!res.ok || !data || typeof data.explanation !== 'string' || !data.explanation.trim()) {
        const error = new Error((data && data.error) || `Request failed (${res.status})`);
        error.status = res.status;
        error.clientError = res.status === 400;
        throw error;
      }
      return data.explanation.trim();
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------- Offline fallback ----------
  const STOP = new Set('the a an and or of to in on for is are was were be by with what why how when which who does do did it its this that as at from can you your me my i explain please simple simply about into than then'.split(' '));

  function keywords(text) {
    return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2 && !STOP.has(w));
  }

  function findRelatedLesson(text, subject) {
    const words = new Set(keywords(text));
    let best = null;
    let bestScore = 0;
    lessons.forEach((l) => {
      const hay = keywords([l.title, l.summary, ...l.keyPoints].join(' '));
      let score = hay.reduce((sum, w) => sum + (words.has(w) ? 1 : 0), 0);
      if (l.subject === subject) score += 0.5;
      if (score > bestScore) { best = l; bestScore = score; }
    });
    return bestScore >= 2 ? best : null;
  }

  function localExplain({ question, answer, subject }) {
    const parts = [];
    const lesson = findRelatedLesson(`${question} ${answer}`, subject);
    const sentences = (answer.match(/[^.!?\n]+[.!?]?/g) || []).map((s) => s.trim()).filter(Boolean);

    if (sentences.length) {
      parts.push('**Let\'s break the answer into small steps:**');
      sentences.slice(0, 8).forEach((s, i) => parts.push(`${i + 1}. ${s}`));
      parts.push('');
    }

    if (lesson) {
      parts.push(`**Related lesson: ${lesson.title}**`);
      parts.push(lesson.summary);
      lesson.keyPoints.forEach((p) => parts.push(`- ${p}`));
      parts.push('');
      parts.push(`Open the "${lesson.title}" lesson in the Lessons page for examples and a quick quiz.`);
      parts.push('');
    }

    if (!sentences.length && !lesson) {
      parts.push('**How to work through this question:**');
      parts.push('- Underline the key words in the question and what it is asking you to find.');
      parts.push('- Write down what you already know about each key word.');
      parts.push('- Connect them step by step, one idea per line.');
      parts.push('- Check your final answer actually responds to the question.');
      parts.push('');
      parts.push('Tip: paste the answer you were given into the second box and the tutor will break it into steps.');
    } else {
      const summary = sentences[0] || (lesson && lesson.summary);
      parts.push(`**In one line:** ${summary}`);
    }
    return parts.join('\n').trim();
  }

  // ---------- Submit ----------
  async function submit() {
    if (busy) return;
    const question = questionEl.value.trim();
    const answer = answerEl.value.trim();
    formError.textContent = '';
    if (!question) {
      formError.textContent = 'Please type a question first.';
      formError.style.color = 'var(--danger)';
      questionEl.focus();
      return;
    }

    const payload = { question, answer, subject: subjectEl.value, level: levelEl.value };
    busy = true;
    submitBtn.disabled = true;
    showLoading();

    let entry;
    try {
      const explanation = await fetchExplanation(payload);
      entry = { ...payload, explanation, source: 'ai' };
    } catch (error) {
      if (error.clientError) {
        output.innerHTML = `<p style="color:var(--danger)">${esc(error.message)}</p>`;
        busy = false;
        submitBtn.disabled = false;
        return;
      }
      console.warn('AI request failed, using offline explanation:', error);
      const reason = error.name === 'AbortError' ? 'request timed out' : error.message;
      entry = { ...payload, explanation: localExplain(payload), source: 'offline', reason };
    }

    entry.id = `${Date.now()}`;
    entry.ts = Date.now();
    showResult(entry);
    saveHistory(entry);
    busy = false;
    submitBtn.disabled = false;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit();
  });

  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    questionEl.value = '';
    answerEl.value = '';
    formError.textContent = '';
    questionEl.focus();
  });

  // ---------- Speech & copy ----------
  const canSpeak = 'speechSynthesis' in window;
  if (!canSpeak) speakBtn.hidden = true;

  function stopSpeaking() {
    if (canSpeak) speechSynthesis.cancel();
    speakBtn.textContent = '🔊 Listen';
  }

  speakBtn.addEventListener('click', () => {
    if (!canSpeak || !currentText) return;
    if (speechSynthesis.speaking) {
      stopSpeaking();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(plainText(currentText));
    utterance.rate = 1;
    utterance.onend = () => { speakBtn.textContent = '🔊 Listen'; };
    utterance.onerror = () => { speakBtn.textContent = '🔊 Listen'; };
    speechSynthesis.speak(utterance);
    speakBtn.textContent = '⏹ Stop';
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(plainText(currentText));
      PX.toast('Explanation copied');
    } catch (e) {
      PX.toast('Could not copy — select the text and copy manually.');
    }
  });

  window.addEventListener('beforeunload', stopSpeaking);

  // ---------- History ----------
  function saveHistory(entry) {
    const history = PX.store.get('history', []);
    history.unshift(entry);
    PX.store.set('history', history.slice(0, HISTORY_LIMIT));
    renderHistory();
  }

  function renderHistory() {
    const history = PX.store.get('history', []);
    clearHistoryBtn.hidden = !history.length;
    if (!history.length) {
      historyEl.innerHTML = '<div class="empty"><span class="emoji" aria-hidden="true">💭</span>Questions you ask will show up here.</div>';
      return;
    }
    historyEl.innerHTML = `<ul class="list">${history.map((h) => `
      <li><button class="history-item" type="button" data-id="${esc(h.id)}">
        <div class="truncate"><strong>${esc(h.question)}</strong></div>
        <div class="small muted">${esc(h.subject)} · ${PX.timeAgo(h.ts)}${h.source === 'offline' ? ' · offline' : ''}</div>
      </button></li>`).join('')}</ul>`;
  }

  historyEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    const entry = PX.store.get('history', []).find((h) => h.id === btn.dataset.id);
    if (!entry) return;
    questionEl.value = entry.question;
    answerEl.value = entry.answer || '';
    if ([...subjectEl.options].some((o) => o.value === entry.subject)) subjectEl.value = entry.subject;
    if (entry.level) levelEl.value = entry.level;
    showResult(entry);
    if (window.matchMedia('(max-width: 1024px)').matches) {
      output.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  clearHistoryBtn.addEventListener('click', async () => {
    const ok = await PX.confirmDialog({
      title: 'Clear history?',
      message: 'This removes all saved questions and explanations from this browser.',
      confirmText: 'Clear history',
      danger: true,
    });
    if (!ok) return;
    PX.store.set('history', []);
    renderHistory();
  });

  renderHistory();
});
