/* Lessons page: library (filter + search) and lesson reader with quiz. */
document.addEventListener('DOMContentLoaded', () => {
  if (!PX.auth.user()) return; // app.js redirects to the login page
  const { esc } = PX;
  const lessons = window.PX_LESSONS || [];

  const libraryView = document.getElementById('libraryView');
  const readerView = document.getElementById('readerView');
  const grid = document.getElementById('lessonGrid');
  const filter = document.getElementById('subjectFilter');
  const search = document.getElementById('search');

  let activeSubject = 'All';

  // ---------- Routing ----------
  function route() {
    const lessonId = PX.param('lesson');
    const subject = PX.param('subject');
    if (lessonId && lessons.some((l) => l.id === lessonId)) {
      showReader(lessonId);
    } else {
      activeSubject = subject && PX.getSubjects().some((s) => s.name === subject) ? subject : 'All';
      showLibrary();
    }
  }

  function navigate(query) {
    history.pushState(null, '', `lessons.html${query}`);
    route();
    window.scrollTo({ top: 0 });
  }

  window.addEventListener('popstate', route);

  // ---------- Library ----------
  function showLibrary() {
    readerView.hidden = true;
    libraryView.hidden = false;
    document.title = 'Lessons · Pathshala-X';
    renderFilter();
    renderGrid();
  }

  function renderFilter() {
    const names = ['All', ...PX.getSubjects().map((s) => s.name)];
    filter.innerHTML = names.map((name) => `
      <button class="chip${name === activeSubject ? ' active' : ''}" type="button" data-subject="${esc(name)}"
        aria-pressed="${name === activeSubject}">${esc(name)}</button>`).join('');
  }

  filter.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-subject]');
    if (!chip) return;
    activeSubject = chip.dataset.subject;
    history.replaceState(null, '', activeSubject === 'All' ? 'lessons.html' : `lessons.html?subject=${encodeURIComponent(activeSubject)}`);
    renderFilter();
    renderGrid();
  });

  search.addEventListener('input', renderGrid);

  function renderGrid() {
    const completed = PX.getCompleted();
    const term = search.value.trim().toLowerCase();
    const title = document.getElementById('libraryTitle');
    const subtitle = document.getElementById('librarySubtitle');

    const pool = lessons.filter((l) => activeSubject === 'All' || l.subject === activeSubject);
    const visible = pool.filter((l) => !term
      || [l.title, l.summary, l.subject, ...l.keyPoints].join(' ').toLowerCase().includes(term));

    if (activeSubject === 'All') {
      title.textContent = 'Lesson library';
      subtitle.textContent = 'Bite-sized lessons with a quick quiz at the end.';
    } else {
      const done = pool.filter((l) => completed[l.id]).length;
      title.textContent = `${activeSubject} lessons`;
      subtitle.textContent = pool.length
        ? `${done} of ${pool.length} completed.`
        : 'Your own subject — use the AI tutor to learn anything about it.';
    }

    if (!pool.length) {
      grid.innerHTML = `
        <div class="card empty" style="grid-column:1/-1">
          <span class="emoji" aria-hidden="true">📝</span>
          <p>There are no built-in lessons for <strong>${esc(activeSubject)}</strong> yet.</p>
          <p class="small" style="margin-top:4px">Ask the AI tutor any ${esc(activeSubject)} question and get a simple explanation.</p>
          <a class="btn" style="margin-top:14px" href="ai.html?subject=${encodeURIComponent(activeSubject)}">Ask about ${esc(activeSubject)} →</a>
        </div>`;
      return;
    }

    if (!visible.length) {
      grid.innerHTML = `<div class="card empty" style="grid-column:1/-1"><span class="emoji" aria-hidden="true">🔍</span>No lessons match “${esc(search.value)}”.</div>`;
      return;
    }

    grid.innerHTML = visible.map((l) => {
      const meta = PX.subjectMeta(l.subject);
      const done = Boolean(completed[l.id]);
      return `
        <a class="card lesson-card" href="lessons.html?lesson=${encodeURIComponent(l.id)}" data-lesson="${esc(l.id)}" style="--subject-color:${meta.color}">
          <div class="row">
            <span class="subject-icon" aria-hidden="true" style="width:34px;height:34px;font-size:17px">${meta.icon}</span>
            <span class="small muted">${esc(l.subject)}</span>
            <span class="spacer"></span>
            ${done ? '<span class="badge badge-success">✓ Done</span>' : `<span class="badge">${l.minutes} min</span>`}
          </div>
          <h3>${esc(l.title)}</h3>
          <p>${esc(l.summary)}</p>
          <span class="small" style="color:var(--primary);font-weight:600">${done ? 'Review' : 'Start'} lesson →</span>
        </a>`;
    }).join('');
  }

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-lesson]');
    if (!card || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(`?lesson=${encodeURIComponent(card.dataset.lesson)}`);
  });

  // ---------- Reader ----------
  function renderBlock(block) {
    if (typeof block === 'string') return `<p>${block}</p>`;
    if (block.formula) return `<div class="formula">${block.formula}</div>`;
    if (block.list) return `<ul>${block.list.map((item) => `<li>${item}</li>`).join('')}</ul>`;
    return '';
  }

  function showReader(id) {
    const lesson = lessons.find((l) => l.id === id);
    const meta = PX.subjectMeta(lesson.subject);
    const index = lessons.filter((l) => l.subject === lesson.subject).indexOf(lesson);
    const siblings = lessons.filter((l) => l.subject === lesson.subject);
    const nextLesson = siblings[index + 1] || lessons.find((l) => !PX.getCompleted()[l.id] && l.id !== id);

    PX.store.set('lastLesson', id);
    document.title = `${lesson.title} · Pathshala-X`;
    libraryView.hidden = true;
    readerView.hidden = false;

    readerView.innerHTML = `
      <a href="lessons.html?subject=${encodeURIComponent(lesson.subject)}" data-back class="small">← ${esc(lesson.subject)} lessons</a>
      <header class="reader-header">
        <div class="row">
          <span class="badge badge-primary">${meta.icon} ${esc(lesson.subject)}</span>
          <span class="badge">${lesson.minutes} min read</span>
          <span class="badge" id="doneBadge"></span>
        </div>
        <h1>${esc(lesson.title)}</h1>
        <p class="muted">${esc(lesson.summary)}</p>
      </header>

      <div class="card prose">
        ${lesson.sections.map((s) => `<h2>${esc(s.heading)}</h2>${s.body.map(renderBlock).join('')}`).join('')}
        <div class="callout">
          <h3>🔑 Key points</h3>
          <ul>${lesson.keyPoints.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        </div>
      </div>

      <section class="card" style="margin-top:18px" aria-labelledby="quizTitle">
        <div class="card-title"><h2 id="quizTitle">Quick check</h2><span class="badge" id="quizScore">0 / ${lesson.quiz.length}</span></div>
        <div id="quiz">
          ${lesson.quiz.map((item, qi) => `
            <div class="quiz-q" data-q="${qi}">
              <p>${qi + 1}. ${esc(item.q)}</p>
              <div class="options">
                ${item.options.map((opt, oi) => `<button class="option" type="button" data-o="${oi}">${esc(opt)}</button>`).join('')}
              </div>
              <div class="feedback" aria-live="polite"></div>
            </div>`).join('')}
        </div>
        <div class="row" style="margin-top:16px"><button class="btn btn-ghost btn-sm" type="button" id="retryQuiz" hidden>Try again</button></div>
      </section>

      <div class="reader-actions">
        <button class="btn btn-lg" type="button" id="toggleDone"></button>
        <a class="btn btn-lg btn-ghost" href="ai.html?subject=${encodeURIComponent(lesson.subject)}&q=${encodeURIComponent(`Can you explain "${lesson.title}" in a simpler way?`)}">💬 Ask AI about this</a>
        <span class="spacer"></span>
        ${nextLesson ? `<a class="btn btn-lg btn-soft" data-next href="lessons.html?lesson=${encodeURIComponent(nextLesson.id)}">Next: ${esc(nextLesson.title)} →</a>` : ''}
      </div>`;

    const toggleBtn = readerView.querySelector('#toggleDone');
    const doneBadge = readerView.querySelector('#doneBadge');
    const renderDone = () => {
      const done = Boolean(PX.getCompleted()[id]);
      toggleBtn.textContent = done ? '↺ Mark as not done' : '✓ Mark as complete';
      toggleBtn.className = done ? 'btn btn-lg btn-ghost' : 'btn btn-lg';
      doneBadge.textContent = done ? '✓ Completed' : 'Not completed';
      doneBadge.className = done ? 'badge badge-success' : 'badge';
    };
    renderDone();

    toggleBtn.addEventListener('click', () => {
      const done = Boolean(PX.getCompleted()[id]);
      PX.setLessonComplete(id, !done);
      renderDone();
      PX.toast(done ? 'Lesson marked as not done' : '🎉 Lesson complete!');
    });

    // Quiz
    const quiz = readerView.querySelector('#quiz');
    const scoreEl = readerView.querySelector('#quizScore');
    const retry = readerView.querySelector('#retryQuiz');
    let answered = 0;
    let correct = 0;

    quiz.addEventListener('click', (e) => {
      const option = e.target.closest('.option');
      if (!option || option.disabled) return;
      const block = option.closest('.quiz-q');
      const item = lesson.quiz[Number(block.dataset.q)];
      const chosen = Number(option.dataset.o);
      const buttons = block.querySelectorAll('.option');
      buttons.forEach((b) => { b.disabled = true; });
      buttons[item.answer].classList.add('correct');
      const isRight = chosen === item.answer;
      if (!isRight) option.classList.add('wrong');
      block.querySelector('.feedback').innerHTML = `${isRight ? '✅ Correct!' : '❌ Not quite.'} ${esc(item.explain)}`;

      answered++;
      if (isRight) correct++;
      scoreEl.textContent = `${correct} / ${lesson.quiz.length}`;
      scoreEl.className = correct === lesson.quiz.length ? 'badge badge-success' : 'badge';

      if (answered === lesson.quiz.length) {
        retry.hidden = false;
        if (correct === lesson.quiz.length && !PX.getCompleted()[id]) {
          PX.setLessonComplete(id, true);
          renderDone();
          PX.toast('🎉 Perfect score — lesson marked complete!');
        } else if (correct < lesson.quiz.length) {
          PX.toast(`You got ${correct} of ${lesson.quiz.length}. Review and try again!`);
        }
      }
    });

    retry.addEventListener('click', () => showReader(id));

    readerView.querySelectorAll('[data-back], [data-next]').forEach((link) => {
      link.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        navigate(new URL(link.href).search);
      });
    });
  }

  route();
});
