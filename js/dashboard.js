/* Dashboard page */
document.addEventListener('DOMContentLoaded', () => {
  const { esc } = PX;
  const lessons = window.PX_LESSONS || [];

  function renderHeader() {
    const now = new Date();
    const hour = now.getHours();
    const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    document.getElementById('greeting').textContent = `${part} 👋`;
    document.getElementById('today').textContent = now.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
    });
  }

  function renderStats() {
    const minutes = Math.floor(PX.secondsToday() / 60);
    const streak = PX.getStreak();
    const completed = PX.getCompleted();
    const doneCount = lessons.filter((l) => completed[l.id]).length;
    const questions = PX.store.get('history', []).length;

    document.getElementById('statToday').textContent = `${minutes} min`;
    document.getElementById('statStreak').textContent = `${streak} ${streak === 1 ? 'day' : 'days'}`;
    document.getElementById('statLessons').textContent = `${doneCount} / ${lessons.length}`;
    document.getElementById('statQuestions').textContent = String(questions);
  }

  function renderGoal() {
    const minutes = Math.floor(PX.secondsToday() / 60);
    const goal = PX.getGoalMinutes();
    const pct = Math.min(100, Math.round((minutes / goal) * 100));
    document.getElementById('goalRing').style.setProperty('--value', pct);
    document.getElementById('goalPct').textContent = `${pct}%`;
    document.getElementById('goalText').textContent = `${minutes} of ${goal} minutes`;
    document.getElementById('goalHint').textContent = pct >= 100
      ? 'Goal complete! Anything extra is a bonus. 🌟'
      : `${goal - minutes} more ${goal - minutes === 1 ? 'minute' : 'minutes'} to reach today's goal.`;
  }

  function renderContinue() {
    const completed = PX.getCompleted();
    const doneCount = lessons.filter((l) => completed[l.id]).length;
    const pct = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;
    const last = lessons.find((l) => l.id === PX.store.get('lastLesson'));
    const next = last && !completed[last.id] ? last : lessons.find((l) => !completed[l.id]);

    document.getElementById('overallPct').textContent = `${pct}%`;
    const bar = document.getElementById('overallBar');
    requestAnimationFrame(() => { bar.style.width = `${pct}%`; });
    bar.classList.toggle('done', pct === 100);
    document.getElementById('overallText').textContent = `${doneCount} of ${lessons.length} lessons completed across all subjects.`;

    const box = document.getElementById('continueBox');
    if (!next) {
      box.innerHTML = `
        <p><strong>You've completed every lesson! 🎓</strong></p>
        <p class="muted small" style="margin-top:4px">Review any topic or ask the AI tutor something new.</p>
        <div class="row" style="margin-top:14px"><a class="btn btn-soft" href="lessons.html">Review lessons</a></div>`;
      return;
    }
    const meta = PX.subjectMeta(next.subject);
    box.innerHTML = `
      <div class="row" style="flex-wrap:nowrap;align-items:flex-start">
        <div class="subject-icon" style="--subject-color:${meta.color}" aria-hidden="true">${meta.icon}</div>
        <div style="min-width:0">
          <div class="small muted">${esc(next.subject)} · ${next.minutes} min</div>
          <p><strong>${esc(next.title)}</strong></p>
          <p class="small muted">${esc(next.summary)}</p>
        </div>
      </div>
      <div class="row" style="margin-top:14px">
        <a class="btn" href="lessons.html?lesson=${encodeURIComponent(next.id)}">${last && last.id === next.id ? 'Resume lesson' : 'Start lesson'} →</a>
      </div>`;
  }

  function renderSubjects() {
    const list = document.getElementById('subjectsList');
    const completed = PX.getCompleted();
    list.innerHTML = '';

    PX.getSubjects().forEach((subject) => {
      const subjectLessons = lessons.filter((l) => l.subject === subject.name);
      const done = subjectLessons.filter((l) => completed[l.id]).length;
      const pct = subjectLessons.length ? Math.round((done / subjectLessons.length) * 100) : 0;

      const wrap = document.createElement('div');
      wrap.style.position = 'relative';
      wrap.innerHTML = `
        <a class="subject-card" href="lessons.html?subject=${encodeURIComponent(subject.name)}" style="--subject-color:${subject.color}">
          <span class="subject-icon" aria-hidden="true">${esc(subject.icon)}</span>
          <span class="subject-name">${esc(subject.name)}</span>
          <span class="small muted">${subjectLessons.length
            ? `${done} of ${subjectLessons.length} lessons`
            : 'Custom subject · ask the AI tutor'}</span>
          <span class="progress-track"><span class="progress-fill" style="display:block;width:${pct}%"></span></span>
        </a>`;

      if (subject.custom) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'subject-remove';
        remove.setAttribute('aria-label', `Remove ${subject.name}`);
        remove.title = 'Remove subject';
        remove.textContent = '✕';
        remove.addEventListener('click', async () => {
          const ok = await PX.confirmDialog({
            title: 'Remove subject?',
            message: `"${subject.name}" will be removed from your subjects.`,
            confirmText: 'Remove',
            danger: true,
          });
          if (!ok) return;
          PX.removeSubject(subject.name);
          renderSubjects();
          PX.toast(`Removed ${subject.name}`);
        });
        wrap.append(remove);
      }
      list.append(wrap);
    });

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'subject-card add';
    add.innerHTML = '<span class="plus" aria-hidden="true">+</span><span>Add your own subject</span>';
    add.addEventListener('click', addSubject);
    list.append(add);
  }

  async function addSubject() {
    const name = await PX.promptDialog({
      title: 'Add a subject',
      label: 'Subject name',
      placeholder: 'e.g. History, Computer Science',
      confirmText: 'Add subject',
      validate: (value) => {
        const clean = value.trim();
        if (!clean) return 'Please enter a subject name.';
        if (PX.getSubjects().some((s) => s.name.toLowerCase() === clean.toLowerCase())) {
          return 'That subject already exists.';
        }
        return '';
      },
    });
    if (name === null) return;
    const result = PX.addSubject(name);
    if (!result.ok) {
      PX.toast(result.error);
      return;
    }
    renderSubjects();
    PX.toast(`Added ${result.name} ✨`);
  }

  function renderActivity() {
    const completed = PX.getCompleted();
    const events = [];
    Object.entries(completed).forEach(([id, ts]) => {
      const lesson = lessons.find((l) => l.id === id);
      if (lesson) {
        events.push({ ts, icon: '✅', text: `Completed <strong>${esc(lesson.title)}</strong>`, href: `lessons.html?lesson=${encodeURIComponent(id)}` });
      }
    });
    PX.store.get('history', []).forEach((item) => {
      events.push({ ts: item.ts, icon: '💬', text: `Asked: <strong>${esc(item.question)}</strong>`, href: 'ai.html' });
    });
    events.sort((a, b) => b.ts - a.ts);

    const list = document.getElementById('activityList');
    if (!events.length) {
      list.innerHTML = `<li class="empty"><span class="emoji" aria-hidden="true">🌱</span>No activity yet. Start a lesson or ask a question to see it here.</li>`;
      return;
    }
    list.innerHTML = events.slice(0, 6).map((e) => `
      <li class="list-item">
        <span aria-hidden="true">${e.icon}</span>
        <a class="grow truncate" href="${e.href}" style="color:inherit">${e.text}</a>
        <span class="small muted">${PX.timeAgo(e.ts)}</span>
      </li>`).join('');
  }

  document.getElementById('editGoal').addEventListener('click', async () => {
    const value = await PX.promptDialog({
      title: 'Daily study goal',
      label: 'Minutes per day',
      type: 'number',
      value: String(PX.getGoalMinutes()),
      min: 5,
      max: 600,
      validate: (v) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 5 && n <= 600 ? '' : 'Enter a number between 5 and 600.';
      },
    });
    if (value === null) return;
    PX.setGoalMinutes(Number(value));
    renderGoal();
    document.dispatchEvent(new CustomEvent('px:activity'));
    PX.toast(`Daily goal set to ${PX.getGoalMinutes()} minutes`);
  });

  document.addEventListener('px:activity', () => {
    renderStats();
    renderGoal();
  });

  renderHeader();
  renderStats();
  renderGoal();
  renderContinue();
  renderSubjects();
  renderActivity();
});
