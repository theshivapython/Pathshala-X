/* Account page: profile, usage history, sign-in history, data controls. */
document.addEventListener('DOMContentLoaded', () => {
  const { auth, esc } = PX;
  if (!auth.user()) return; // app.js is redirecting to login
  const lessons = window.PX_LESSONS || [];

  const fmtDate = (ts) => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const fmtDateTime = (ts) => new Date(ts).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
  const fmtMinutes = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);

  // ---------- Profile ----------
  function renderProfile() {
    const user = auth.user();
    document.getElementById('avatar').textContent = auth.initials(user.name);
    document.getElementById('profileName').textContent = user.name;
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('demoBadge').hidden = !user.isDemo;
    document.getElementById('memberSince').textContent = fmtDate(user.createdAt);
    document.getElementById('previousVisit').textContent = user.previousLoginAt
      ? `${fmtDateTime(user.previousLoginAt)} (${PX.timeAgo(user.previousLoginAt)})`
      : 'This is your first visit 🎉';
    // Keep the sidebar card in sync after edits.
    const sidebarName = document.querySelector('.user-meta strong');
    if (sidebarName) sidebarName.textContent = user.name;
    const sidebarAvatar = document.querySelector('.user-card .avatar');
    if (sidebarAvatar) sidebarAvatar.textContent = auth.initials(user.name);
  }

  // ---------- Usage ----------
  function renderUsage() {
    const activity = PX.getActivity();
    const totalSeconds = Object.values(activity).reduce((a, b) => a + b, 0);
    const activeDays = Object.values(activity).filter((s) => s >= 60).length;
    const completed = PX.getCompleted();
    const focus = Object.values(PX.store.get('focusSessions', {})).reduce((a, b) => a + b, 0);

    document.getElementById('totalTime').textContent = fmtMinutes(Math.floor(totalSeconds / 60));
    document.getElementById('activeDays').textContent = String(activeDays);
    document.getElementById('lessonsDone').textContent = `${lessons.filter((l) => completed[l.id]).length} / ${lessons.length}`;
    document.getElementById('focusTotal').textContent = String(focus);
  }

  // ---------- 7-day chart ----------
  function renderChart() {
    const activity = PX.getActivity();
    const goal = PX.getGoalMinutes();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        date: d,
        minutes: Math.floor((activity[PX.dateKey(d)] || 0) / 60),
        label: i === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' }),
        full: d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }),
        today: i === 0,
      });
    }
    const total = days.reduce((sum, d) => sum + d.minutes, 0);
    const goalDays = days.filter((d) => d.minutes >= goal).length;
    // Gridlines sit at every 25%, so pick the smallest clean step that fits 4 of them.
    const peak = Math.max(goal, ...days.map((d) => d.minutes), 1);
    const step = [5, 10, 15, 20, 30, 60, 120].find((st) => st * 4 >= peak) || Math.ceil(peak / 4);
    const max = step * 4;
    document.getElementById('chartKey').textContent = `Daily goal (${goal} min)`;
    document.getElementById('chartSummary').textContent =
      `${fmtMinutes(total)} this week · ${Math.round(total / 7)} min a day on average · goal met on ${goalDays} of 7 days`;

    const chart = document.getElementById('chart');
    chart.innerHTML = `
      <div class="bars" role="img" aria-label="Minutes studied per day for the last 7 days. Total ${total} minutes.">
        ${days.map((d, i) => `
          <div class="bar-slot" data-i="${i}" tabindex="0" aria-label="${esc(d.full)}: ${d.minutes} minutes">
            <div class="bar${d.minutes ? '' : ' zero'}" style="height:0"></div>
          </div>`).join('')}
        <div class="goal-line" style="bottom:${(goal / max) * 100}%"></div>
        <span class="axis-max">${max} min</span>
      </div>
      <div class="bar-labels">${days.map((d) => `<span class="${d.today ? 'today' : ''}">${esc(d.label)}</span>`).join('')}</div>`;

    requestAnimationFrame(() => {
      chart.querySelectorAll('.bar').forEach((bar, i) => {
        bar.style.height = `${(days[i].minutes / max) * 100}%`;
      });
    });

    // Hover / focus tooltip
    let tip = null;
    const show = (slot) => {
      const d = days[Number(slot.dataset.i)];
      if (!tip) {
        tip = document.createElement('div');
        tip.className = 'chart-tip';
        chart.append(tip);
      }
      tip.innerHTML = `<strong>${d.minutes} min</strong> · ${esc(d.full)}${d.minutes >= goal ? ' ✓ goal' : ''}`;
      const bar = slot.querySelector('.bar');
      const chartBox = chart.getBoundingClientRect();
      const barBox = bar.getBoundingClientRect();
      const x = Math.min(Math.max(barBox.left + barBox.width / 2 - chartBox.left, 70), chartBox.width - 70);
      tip.style.left = `${x}px`;
      tip.style.top = `${barBox.top - chartBox.top}px`;
    };
    const hide = () => { if (tip) { tip.remove(); tip = null; } };
    chart.querySelectorAll('.bar-slot').forEach((slot) => {
      slot.addEventListener('mouseenter', () => show(slot));
      slot.addEventListener('focus', () => show(slot));
      slot.addEventListener('mouseleave', hide);
      slot.addEventListener('blur', hide);
    });

    document.getElementById('chartTable').innerHTML = days.map((d) => `
      <tr><td>${esc(d.full)}</td><td class="num">${d.minutes}</td></tr>`).join('');
  }

  // ---------- Learning & sign-in history ----------
  function renderLearning() {
    const completed = PX.getCompleted();
    const events = Object.entries(completed)
      .map(([id, ts]) => ({ lesson: lessons.find((l) => l.id === id), ts }))
      .filter((e) => e.lesson)
      .map((e) => ({ ts: e.ts, icon: '✅', text: `Completed <strong>${esc(e.lesson.title)}</strong>`, href: `lessons.html?lesson=${encodeURIComponent(e.lesson.id)}` }));
    PX.store.get('history', []).forEach((h) => {
      events.push({ ts: h.ts, icon: '💬', text: `Asked <strong>${esc(h.question)}</strong>`, href: 'ai.html' });
    });
    events.sort((a, b) => b.ts - a.ts);

    const list = document.getElementById('learningList');
    list.innerHTML = events.length
      ? events.slice(0, 8).map((e) => `
          <li class="list-item">
            <span aria-hidden="true">${e.icon}</span>
            <a class="grow truncate" href="${e.href}" style="color:inherit">${e.text}</a>
            <span class="small muted" title="${esc(fmtDateTime(e.ts))}">${PX.timeAgo(e.ts)}</span>
          </li>`).join('')
      : '<li class="empty"><span class="emoji" aria-hidden="true">🌱</span>Nothing yet. Complete a lesson or ask the AI tutor a question.</li>';
  }

  function renderLogins() {
    const logins = auth.user().logins || [];
    document.getElementById('loginList').innerHTML = logins.length
      ? logins.slice(0, 8).map((l, i) => `
          <li class="list-item">
            <span aria-hidden="true">${i === 0 ? '🟢' : '🔐'}</span>
            <span class="grow">
              <span style="display:block;font-weight:600">${esc(fmtDateTime(l.ts))}</span>
              <span class="small muted">${esc(l.device)}</span>
            </span>
            <span class="small ${i === 0 ? '' : 'muted'}">${i === 0 ? 'Current session' : PX.timeAgo(l.ts)}</span>
          </li>`).join('')
      : '<li class="empty">No sign-ins recorded yet.</li>';
  }

  // ---------- Actions ----------
  document.getElementById('signOut').addEventListener('click', auth.signOut);

  document.getElementById('editName').addEventListener('click', async () => {
    const name = await PX.promptDialog({
      title: 'Edit your name',
      label: 'Display name',
      value: auth.user().name,
      validate: (v) => (v.trim() && v.trim().length <= 40 ? '' : 'Please enter a name (up to 40 characters).'),
    });
    if (name === null) return;
    const result = auth.updateName(name);
    if (!result.ok) return PX.toast(result.error);
    renderProfile();
    PX.toast('Name updated');
  });

  document.getElementById('changePassword').addEventListener('click', () => {
    const dialog = document.createElement('dialog');
    dialog.innerHTML = `
      <form novalidate>
        <h2>Change password</h2>
        <div class="field">
          <label for="pwCurrent">Current password</label>
          <input class="input" id="pwCurrent" type="password" autocomplete="current-password">
        </div>
        <div class="field">
          <label for="pwNew">New password</label>
          <input class="input" id="pwNew" type="password" autocomplete="new-password" placeholder="At least 6 characters">
        </div>
        <div class="field">
          <label for="pwConfirm">Confirm new password</label>
          <input class="input" id="pwConfirm" type="password" autocomplete="new-password">
          <div class="field-error" id="pwError" role="alert"></div>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-ghost" type="button" data-cancel>Cancel</button>
          <button class="btn" type="submit">Update password</button>
        </div>
      </form>`;
    document.body.append(dialog);
    const error = dialog.querySelector('#pwError');
    dialog.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const current = dialog.querySelector('#pwCurrent').value;
      const next = dialog.querySelector('#pwNew').value;
      if (next !== dialog.querySelector('#pwConfirm').value) {
        error.textContent = 'The new passwords do not match.';
        return;
      }
      const result = await auth.changePassword(current, next);
      if (!result.ok) {
        error.textContent = result.error;
        return;
      }
      dialog.close();
      PX.toast('Password updated 🔑');
    });
    dialog.showModal();
  });

  document.getElementById('exportData').addEventListener('click', () => {
    const data = auth.exportUserData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pathshala-x-${PX.dateKey()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  document.getElementById('deleteAccount').addEventListener('click', async () => {
    const ok = await PX.confirmDialog({
      title: 'Delete your account?',
      message: 'This permanently removes your account, lessons progress, questions, notes and study history from this browser. It cannot be undone.',
      confirmText: 'Delete account',
      danger: true,
    });
    if (ok) auth.deleteAccount();
  });

  renderProfile();
  renderUsage();
  renderChart();
  renderLearning();
  renderLogins();
  document.addEventListener('px:activity', renderUsage);
});
