/* Ask AI page: multilingual explanations, file attachments, follow-up questions,
   read-aloud and explainer videos. Falls back to built-in explanations offline. */
document.addEventListener('DOMContentLoaded', () => {
  if (!PX.auth.user()) return; // app.js redirects to the login page
  const { esc } = PX;
  const lessons = window.PX_LESSONS || [];
  const HISTORY_LIMIT = 30;
  const MAX_FILES = 3;
  const MAX_FILE_BYTES = 3 * 1024 * 1024;
  const MAX_TEXT_CHARS = 20000;
  const OTHER = '__other';

  const $ = (id) => document.getElementById(id);
  const form = $('askForm');
  const subjectEl = $('subject');
  const levelEl = $('level');
  const languageEl = $('language');
  const customLanguageEl = $('customLanguage');
  const questionEl = $('question');
  const answerEl = $('answer');
  const submitBtn = $('submitBtn');
  const formError = $('formError');
  const fileInput = $('fileInput');
  const dropzone = $('dropzone');
  const attachList = $('attachList');
  const threadEl = $('thread');
  const followForm = $('followForm');
  const followInput = $('followInput');
  const followBtn = $('followBtn');
  const suggestionsEl = $('suggestions');
  const newThreadBtn = $('newThread');
  const historyEl = $('history');
  const clearHistoryBtn = $('clearHistory');

  let attachments = []; // files for the next question: { id, name, type, size, data?, text?, preview? }
  let thread = null; // current conversation
  let busy = false;

  // ---------- Setup ----------
  subjectEl.innerHTML = ['General', ...PX.getSubjects().map((s) => s.name)]
    .map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');

  languageEl.innerHTML = PXSpeech.LANGUAGES.map((g) => `
    <optgroup label="${esc(g.group)}">
      ${g.items.map((l) => `<option value="${esc(l.name)}">${esc(l.name === l.native ? l.name : `${l.name} — ${l.native}`)}</option>`).join('')}
    </optgroup>`).join('') + `<option value="${OTHER}">Other language…</option>`;

  function setLanguage(name) {
    const known = [...languageEl.options].some((o) => o.value === name);
    languageEl.value = known ? name : OTHER;
    customLanguageEl.hidden = known;
    if (!known) customLanguageEl.value = name;
  }

  function getLanguage() {
    if (languageEl.value !== OTHER) return languageEl.value;
    return customLanguageEl.value.trim().replace(/\s+/g, ' ') || 'English';
  }

  setLanguage(PX.store.get('language', 'English'));
  languageEl.addEventListener('change', () => {
    customLanguageEl.hidden = languageEl.value !== OTHER;
    if (languageEl.value === OTHER) customLanguageEl.focus();
    else PX.store.set('language', languageEl.value);
  });
  customLanguageEl.addEventListener('change', () => PX.store.set('language', getLanguage()));

  const presetSubject = PX.param('subject');
  if (presetSubject && [...subjectEl.options].some((o) => o.value === presetSubject)) subjectEl.value = presetSubject;
  const presetQuestion = PX.param('q');
  if (presetQuestion) questionEl.value = presetQuestion.slice(0, 2000);

  function showError(message) {
    formError.textContent = message;
    formError.style.color = message ? 'var(--danger)' : '';
  }

  // ---------- Attachments ----------
  const kindOf = (file) => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf';
    if (file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name)) return 'text';
    return null;
  };

  const readAs = (file, method) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader[method](file);
  });

  /** Resizes photos (max 1600px, JPEG) so they upload fast and fit request limits. */
  async function compressImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.85);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function addFiles(fileList) {
    showError('');
    for (const file of [...fileList]) {
      if (attachments.length >= MAX_FILES) {
        showError(`You can attach up to ${MAX_FILES} files.`);
        break;
      }
      const kind = kindOf(file);
      if (!kind) {
        showError(`"${file.name}" isn't supported. Use a photo, PDF or text file.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES && kind !== 'image') {
        showError(`"${file.name}" is larger than 3 MB. Please use a smaller file.`);
        continue;
      }
      const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name || 'pasted-image.png', size: file.size, kind };
      try {
        if (kind === 'image') {
          item.data = await compressImage(file);
          item.type = 'image/jpeg';
          item.preview = item.data;
        } else if (kind === 'pdf') {
          item.type = 'application/pdf';
          item.data = (await readAs(file, 'readAsDataURL')).replace(/^data:[^;]*;/, 'data:application/pdf;');
        } else {
          const text = await readAs(file, 'readAsText');
          item.type = 'text/plain';
          item.text = text.slice(0, MAX_TEXT_CHARS);
          if (text.length > MAX_TEXT_CHARS) PX.toast(`Only the first ${MAX_TEXT_CHARS.toLocaleString()} characters of "${file.name}" will be used.`);
        }
      } catch (e) {
        showError(`Couldn't read "${file.name}".`);
        continue;
      }
      attachments.push(item);
    }
    renderAttachments();
  }

  const fileIcon = (kind) => ({ image: '🖼️', pdf: '📄', text: '📝' })[kind] || '📎';
  const fmtSize = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

  function renderAttachments() {
    attachList.innerHTML = attachments.map((a) => `
      <li class="attach-chip">
        ${a.preview ? `<img src="${a.preview}" alt="">` : `<span class="attach-icon" aria-hidden="true">${fileIcon(a.kind)}</span>`}
        <span class="truncate" title="${esc(a.name)}">${esc(a.name)}</span>
        <span class="small muted">${fmtSize(a.size)}</span>
        <button type="button" class="attach-remove" data-remove="${a.id}" aria-label="Remove ${esc(a.name)}">✕</button>
      </li>`).join('');
  }

  attachList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    attachments = attachments.filter((a) => a.id !== btn.dataset.remove);
    renderAttachments();
  });

  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });
  ['dragenter', 'dragover'].forEach((type) => form.addEventListener(type, (e) => {
    if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
    e.preventDefault();
    dropzone.classList.add('active');
  }));
  ['dragleave', 'drop'].forEach((type) => form.addEventListener(type, (e) => {
    if (type === 'dragleave' && form.contains(e.relatedTarget)) return;
    dropzone.classList.remove('active');
  }));
  form.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  });
  questionEl.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    addFiles(files);
    PX.toast('Screenshot attached 📎');
  });

  // ---------- Markdown ----------
  /** Minimal, safe markdown: paragraphs, bullet/numbered lists, **bold**, `code`, ### headings. */
  function renderMarkdown(text) {
    const inline = (s) => esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
    let html = '';
    let list = null;
    const closeList = () => {
      if (list) { html += `</${list}>`; list = null; }
    };
    text.replace(/\r/g, '').split('\n').forEach((raw) => {
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

  // ---------- API ----------
  async function requestExplanation(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
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
        error.clientError = res.status === 400 || res.status === 413;
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

  function localExplain({ question, answer, subject, textFiles = '', hasBinaryFiles = false }) {
    const parts = [];
    const source = answer || textFiles;
    const lesson = findRelatedLesson(`${question} ${source}`, subject);
    const sentences = (source.match(/[^.!?\n]+[.!?]?/g) || []).map((s) => s.trim()).filter(Boolean);

    if (hasBinaryFiles) {
      parts.push('**Photos and PDFs need the AI service** to be read. Type the question into the box as well, and you will still get help here.');
      parts.push('');
    }
    if (sentences.length) {
      parts.push("**Let's break the answer into small steps:**");
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
      parts.push(`**In one line:** ${sentences[0] || (lesson && lesson.summary)}`);
    }
    return parts.join('\n').trim();
  }

  function localFollowUp(text) {
    const lesson = findRelatedLesson(`${text} ${thread.question}`, thread.subject);
    return [
      "**I can't reach the AI service right now**, so I can't answer follow-up questions yet.",
      '',
      '- Read the explanation above again, one step at a time.',
      lesson ? `- Open the **${lesson.title}** lesson for a worked example and a quiz.` : '- Look for a matching lesson on the Lessons page.',
      '- Try asking again in a little while.',
    ].join('\n');
  }

  // ---------- Thread rendering ----------
  const levelLabel = { simple: 'Beginner', student: 'Student', exam: 'Exam revision' };

  function offlineNotice(msg) {
    if (msg.source !== 'offline') return '';
    const nonEnglish = !/^english$/i.test(thread.language);
    return `<div class="notice"><span aria-hidden="true">📴</span><span>The AI service isn't reachable right now${msg.reason ? ` (${esc(msg.reason)})` : ''}, so this is a built-in explanation${nonEnglish ? ' in English' : ''}. Set <code>OPENAI_API_KEY</code> on the server for full AI answers in ${esc(thread.language)}.</span></div>`;
  }

  function renderThread() {
    if (!thread) {
      threadEl.innerHTML = '<p class="output-placeholder">Your explanation will appear here. You can then ask follow-up questions, listen to it, or make a video.</p>';
      followForm.hidden = true;
      newThreadBtn.hidden = true;
      return;
    }
    const files = thread.files || [];
    let html = `
      <div class="msg msg-user" dir="auto">
        <div class="msg-meta">${esc(thread.subject)} · ${esc(levelLabel[thread.level] || 'Student')} · ${esc(PXSpeech.languageInfo(thread.language).native)}</div>
        ${thread.question ? `<p>${esc(thread.question)}</p>` : '<p class="muted">Explain the attached file</p>'}
        ${thread.answer ? `<details class="given"><summary>Answer given</summary><p>${esc(thread.answer)}</p></details>` : ''}
        ${files.length ? `<div class="msg-files">${files.map((f) => `<span class="badge">${fileIcon(f.kind)} ${esc(f.name)}</span>`).join('')}</div>` : ''}
      </div>`;

    thread.messages.forEach((m, i) => {
      if (m.role === 'user') {
        html += `<div class="msg msg-user" dir="auto"><p>${esc(m.text)}</p></div>`;
        return;
      }
      html += `
        <div class="msg msg-ai" data-index="${i}">
          ${offlineNotice(m)}
          <div class="output-body" dir="auto">${renderMarkdown(m.text)}</div>
          <div class="msg-actions">
            <button class="btn btn-ghost btn-sm" type="button" data-action="listen">🔊 Listen</button>
            <button class="btn btn-ghost btn-sm" type="button" data-action="copy">📋 Copy</button>
            <button class="btn btn-soft btn-sm" type="button" data-action="video">🎬 Make a video</button>
          </div>
        </div>`;
    });

    if (busy) {
      html += '<div class="msg msg-pending"><div class="typing"><span class="dots" aria-hidden="true"><span></span><span></span><span></span></span> The tutor is thinking…</div></div>';
    }
    if (thread.restored && (thread.files || []).some((f) => f.kind !== 'text')) {
      html += '<p class="hint">Attached files aren\'t saved in history. Attach them again in a new question if you need the tutor to look at them.</p>';
    }
    threadEl.innerHTML = html;
    followForm.hidden = !thread.messages.length;
    newThreadBtn.hidden = false;
    renderSuggestions();
  }

  function renderSuggestions() {
    const ideas = ['Explain it more simply', 'Give me another example', 'Explain it step by step', 'Quiz me on this'];
    suggestionsEl.innerHTML = ideas.map((s) => `<button class="chip" type="button" data-suggest="${esc(s)}">${esc(s)}</button>`).join('');
  }

  function questionForMessage(index) {
    // The question an assistant message answers: the user turn right before it, or the original question.
    for (let i = index - 1; i >= 0; i--) {
      if (thread.messages[i].role === 'user') return thread.messages[i].text;
    }
    return thread.question || (thread.files || []).map((f) => f.name).join(', ');
  }

  threadEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const index = Number(btn.closest('[data-index]').dataset.index);
    const msg = thread.messages[index];
    const language = msg.source === 'offline' ? 'English' : thread.language;
    if (btn.dataset.action === 'listen') {
      PXSpeech.toggle(btn, msg.text, language);
    } else if (btn.dataset.action === 'copy') {
      try {
        await navigator.clipboard.writeText(PXSpeech.plain(msg.text));
        PX.toast('Explanation copied');
      } catch (err) {
        PX.toast('Could not copy — select the text and copy manually.');
      }
    } else if (btn.dataset.action === 'video') {
      PXVideo.open({ question: questionForMessage(index), subject: thread.subject, language, explanation: msg.text });
    }
  });

  // ---------- Asking ----------
  function apiAttachments(list) {
    return list.map((a) => (a.text !== undefined
      ? { name: a.name, type: a.type, text: a.text }
      : { name: a.name, type: a.type, data: a.data }));
  }

  async function ask(followUpText) {
    if (busy) return;
    showError('');
    PXSpeech.stop();

    if (!followUpText) {
      const question = questionEl.value.trim();
      if (!question && !attachments.length) {
        showError('Please type a question or attach a file.');
        questionEl.focus();
        return;
      }
      thread = {
        id: `${Date.now()}`,
        ts: Date.now(),
        question,
        answer: answerEl.value.trim(),
        subject: subjectEl.value,
        level: levelEl.value,
        language: getLanguage(),
        files: attachments.map((a) => ({ name: a.name, kind: a.kind })),
        attachments: attachments.slice(),
        messages: [],
      };
      PX.store.set('language', thread.language);
    } else {
      thread.messages.push({ role: 'user', text: followUpText });
    }

    const payload = {
      question: thread.question,
      answer: thread.answer,
      subject: thread.subject,
      level: thread.level,
      language: thread.language,
      attachments: apiAttachments(thread.attachments || []),
      followUps: thread.messages.map((m) => ({ role: m.role, content: m.text })),
    };

    busy = true;
    submitBtn.disabled = true;
    followBtn.disabled = true;
    renderThread();
    threadEl.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
      const text = await requestExplanation(payload);
      thread.messages.push({ role: 'assistant', text, source: 'ai' });
    } catch (error) {
      if (error.clientError) {
        // The server rejected the input — show why and let the student fix it.
        if (followUpText) thread.messages.pop();
        else thread = thread.messages.length ? thread : null;
        busy = false;
        submitBtn.disabled = false;
        followBtn.disabled = false;
        renderThread();
        showError(error.message);
        if (followUpText) PX.toast(error.message);
        return;
      }
      console.warn('AI request failed, using offline explanation:', error);
      const reason = error.name === 'AbortError' ? 'request timed out' : error.message;
      const textFiles = (thread.attachments || []).filter((a) => a.text !== undefined).map((a) => a.text).join('\n');
      const text = followUpText
        ? localFollowUp(followUpText)
        : localExplain({
          question: thread.question, answer: thread.answer, subject: thread.subject, textFiles,
          hasBinaryFiles: (thread.attachments || []).some((a) => a.text === undefined),
        });
      thread.messages.push({ role: 'assistant', text, source: 'offline', reason });
    }

    busy = false;
    submitBtn.disabled = false;
    followBtn.disabled = false;
    if (!followUpText) {
      attachments = [];
      renderAttachments();
    }
    renderThread();
    const last = [...threadEl.querySelectorAll('.msg-ai')].pop();
    if (last && followUpText) last.scrollIntoView({ behavior: 'smooth', block: 'start' });
    saveHistory();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ask();
  });
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      ask();
    }
  });
  followForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = followInput.value.trim();
    if (!text) return followInput.focus();
    followInput.value = '';
    ask(text);
  });
  suggestionsEl.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-suggest]');
    if (chip) ask(chip.dataset.suggest);
  });

  $('clearBtn').addEventListener('click', () => {
    questionEl.value = '';
    answerEl.value = '';
    attachments = [];
    renderAttachments();
    showError('');
    questionEl.focus();
  });

  newThreadBtn.addEventListener('click', () => {
    PXSpeech.stop();
    thread = null;
    renderThread();
    questionEl.value = '';
    answerEl.value = '';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    questionEl.focus({ preventScroll: true });
  });

  // ---------- History ----------
  function saveHistory() {
    if (!thread || !thread.messages.length) return;
    const { attachments: _files, restored, ...entry } = thread;
    const first = thread.messages.find((m) => m.role === 'assistant');
    entry.source = first ? first.source : 'ai';
    const history = PX.store.get('history', []).filter((h) => h.id !== thread.id);
    history.unshift(entry);
    PX.store.set('history', history.slice(0, HISTORY_LIMIT));
    renderHistory();
  }

  /** Older entries stored a single `explanation` string instead of `messages`. */
  function toThread(entry) {
    const messages = entry.messages || [{ role: 'assistant', text: entry.explanation || '', source: entry.source, reason: entry.reason }];
    return {
      ...entry,
      language: entry.language || 'English',
      files: entry.files || [],
      attachments: [],
      messages,
      restored: true,
    };
  }

  function renderHistory() {
    const history = PX.store.get('history', []);
    clearHistoryBtn.hidden = !history.length;
    if (!history.length) {
      historyEl.innerHTML = '<div class="empty"><span class="emoji" aria-hidden="true">💭</span>Questions you ask will show up here.</div>';
      return;
    }
    historyEl.innerHTML = `<ul class="list">${history.map((h) => {
      const followUps = (h.messages || []).filter((m) => m.role === 'user').length;
      const lang = h.language && !/^english$/i.test(h.language) ? ` · ${esc(PXSpeech.languageInfo(h.language).native)}` : '';
      return `
      <li><button class="history-item" type="button" data-id="${esc(h.id)}">
        <div class="truncate" dir="auto"><strong>${esc(h.question || (h.files || []).map((f) => f.name).join(', ') || 'Attached file')}</strong></div>
        <div class="small muted">${esc(h.subject)}${lang} · ${PX.timeAgo(h.ts)}${followUps ? ` · ${followUps} follow-up${followUps > 1 ? 's' : ''}` : ''}${h.source === 'offline' ? ' · offline' : ''}</div>
      </button></li>`;
    }).join('')}</ul>`;
  }

  historyEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    const entry = PX.store.get('history', []).find((h) => h.id === btn.dataset.id);
    if (!entry) return;
    PXSpeech.stop();
    thread = toThread(entry);
    if ([...subjectEl.options].some((o) => o.value === thread.subject)) subjectEl.value = thread.subject;
    if (thread.level) levelEl.value = thread.level;
    setLanguage(thread.language);
    renderThread();
    if (window.matchMedia('(max-width: 1024px)').matches) {
      threadEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  renderThread();
  renderHistory();
});
