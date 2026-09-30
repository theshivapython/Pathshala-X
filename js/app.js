/* Pathshala-X shared runtime: layout, theme, storage, study tracking, UI helpers. */
(function () {
  'use strict';

  const PREFIX = 'px:';

  // ---------- Storage ----------
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
      } catch (e) {
        /* storage unavailable (private mode etc.) — app keeps working in-memory */
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(PREFIX + key);
      } catch (e) { /* ignore */ }
    },
  };

  // ---------- Helpers ----------
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function dateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function timeAgo(ts) {
    const diff = Math.max(0, Date.now() - ts) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
    const days = Math.floor(diff / 86400);
    return days === 1 ? 'yesterday' : `${days} days ago`;
  }

  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }

  // ---------- Subjects ----------
  const DEFAULT_SUBJECTS = [
    { name: 'Math', icon: '➗', color: '#6366f1' },
    { name: 'Physics', icon: '⚛️', color: '#0ea5e9' },
    { name: 'Chemistry', icon: '🧪', color: '#f59e0b' },
    { name: 'Biology', icon: '🧬', color: '#10b981' },
  ];
  const CUSTOM_COLORS = ['#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#ef4444', '#84cc16'];

  // One-time migration from the original app, which kept every subject under "subjects".
  (function migrateLegacySubjects() {
    try {
      const legacy = JSON.parse(localStorage.getItem('subjects'));
      if (Array.isArray(legacy) && store.get('customSubjects') === undefined) {
        const defaults = DEFAULT_SUBJECTS.map((s) => s.name);
        store.set('customSubjects', legacy.filter((s) => typeof s === 'string' && !defaults.includes(s)));
      }
      localStorage.removeItem('subjects');
    } catch (e) { /* ignore */ }
  })();

  function getSubjects() {
    const custom = store.get('customSubjects', []);
    return DEFAULT_SUBJECTS.map((s) => ({ ...s, custom: false })).concat(
      custom.map((name, i) => ({
        name,
        icon: name.trim().charAt(0).toUpperCase() || '📘',
        color: CUSTOM_COLORS[i % CUSTOM_COLORS.length],
        custom: true,
      }))
    );
  }

  function addSubject(name) {
    const clean = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!clean) return { ok: false, error: 'Please enter a subject name.' };
    const exists = getSubjects().some((s) => s.name.toLowerCase() === clean.toLowerCase());
    if (exists) return { ok: false, error: `"${clean}" is already in your subjects.` };
    store.set('customSubjects', [...store.get('customSubjects', []), clean]);
    return { ok: true, name: clean };
  }

  function removeSubject(name) {
    store.set('customSubjects', store.get('customSubjects', []).filter((s) => s !== name));
  }

  function subjectMeta(name) {
    return getSubjects().find((s) => s.name === name) || { name, icon: '📘', color: '#6366f1', custom: true };
  }

  // ---------- Progress ----------
  function getCompleted() {
    return store.get('completed', {});
  }

  function setLessonComplete(id, done = true) {
    const completed = getCompleted();
    if (done) completed[id] = Date.now();
    else delete completed[id];
    store.set('completed', completed);
  }

  // ---------- Study time tracking ----------
  const TICK_SECONDS = 15;

  function getActivity() {
    return store.get('activity', {});
  }

  function secondsToday() {
    return getActivity()[dateKey()] || 0;
  }

  function getGoalMinutes() {
    return store.get('goalMinutes', 20);
  }

  function setGoalMinutes(minutes) {
    store.set('goalMinutes', Math.min(600, Math.max(5, Math.round(minutes))));
  }

  function getStreak() {
    const activity = getActivity();
    const day = new Date();
    // Today still counts as "in progress", so start from yesterday if nothing logged yet.
    if (!(activity[dateKey(day)] >= 60)) day.setDate(day.getDate() - 1);
    let streak = 0;
    while (activity[dateKey(day)] >= 60) {
      streak++;
      day.setDate(day.getDate() - 1);
    }
    return streak;
  }

  function startTracking() {
    let wasBelowGoal = secondsToday() < getGoalMinutes() * 60;
    setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const activity = getActivity();
      const key = dateKey();
      activity[key] = (activity[key] || 0) + TICK_SECONDS;
      store.set('activity', activity);
      const reached = activity[key] >= getGoalMinutes() * 60;
      if (wasBelowGoal && reached) toast('🎉 Daily goal reached — great work!');
      wasBelowGoal = !reached;
      document.dispatchEvent(new CustomEvent('px:activity'));
    }, TICK_SECONDS * 1000);
  }

  // ---------- Theme ----------
  function currentTheme() {
    const saved = document.documentElement.dataset.theme;
    if (saved) return saved;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    store.set('theme', theme);
    renderThemeButton();
  }

  function renderThemeButton() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const dark = currentTheme() === 'dark';
    btn.innerHTML = dark ? '<span aria-hidden="true">☀️</span> Light mode' : '<span aria-hidden="true">🌙</span> Dark mode';
    btn.setAttribute('aria-pressed', String(dark));
  }

  // ---------- Layout ----------
  const NAV = [
    { id: 'dashboard', href: 'index.html', icon: '🏠', label: 'Dashboard' },
    { id: 'lessons', href: 'lessons.html', icon: '📚', label: 'Lessons' },
    { id: 'ai', href: 'ai.html', icon: '💬', label: 'Ask AI' },
    { id: 'tools', href: 'tools.html', icon: '🧰', label: 'Tools' },
  ];

  const BRAND = '<span class="brand-mark" aria-hidden="true">P</span><span>Pathshala<span>-X</span></span>';

  function renderLayout() {
    const page = document.body.dataset.page;
    const app = document.querySelector('.app');
    if (!app) return;

    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.id = 'sidebar';
    sidebar.setAttribute('aria-label', 'Main navigation');
    sidebar.innerHTML = `
      <a class="brand" href="index.html">${BRAND}</a>
      <nav class="nav">
        ${NAV.map((n) => `
          <a class="nav-item${n.id === page ? ' active' : ''}" href="${n.href}"${n.id === page ? ' aria-current="page"' : ''}>
            <span class="nav-icon" aria-hidden="true">${n.icon}</span>${n.label}
          </a>`).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="mini-goal">
          <div>Today: <strong id="miniGoalText">0 / 20 min</strong></div>
          <div class="progress-track"><div class="progress-fill" id="miniGoalBar"></div></div>
        </div>
        <button class="theme-toggle" id="themeToggle" type="button"></button>
      </div>`;

    const topbar = document.createElement('header');
    topbar.className = 'topbar';
    topbar.innerHTML = `
      <button class="menu-btn" id="menuBtn" type="button" aria-label="Open menu" aria-controls="sidebar" aria-expanded="false">☰</button>
      <a class="brand" href="index.html">${BRAND}</a>`;

    const scrim = document.createElement('div');
    scrim.className = 'scrim';

    app.prepend(sidebar);
    document.body.prepend(topbar);
    document.body.append(scrim);

    const menuBtn = topbar.querySelector('#menuBtn');
    const setOpen = (open) => {
      document.body.classList.toggle('nav-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    };
    menuBtn.addEventListener('click', () => setOpen(!document.body.classList.contains('nav-open')));
    scrim.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });

    document.getElementById('themeToggle').addEventListener('click', () => {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
    renderThemeButton();
    renderMiniGoal();
    document.addEventListener('px:activity', renderMiniGoal);
  }

  function renderMiniGoal() {
    const text = document.getElementById('miniGoalText');
    const bar = document.getElementById('miniGoalBar');
    if (!text || !bar) return;
    const minutes = Math.floor(secondsToday() / 60);
    const goal = getGoalMinutes();
    text.textContent = `${minutes} / ${goal} min`;
    const pct = Math.min(100, (minutes / goal) * 100);
    bar.style.width = `${pct}%`;
    bar.classList.toggle('done', pct >= 100);
  }

  // ---------- Toasts ----------
  function toast(message) {
    let region = document.querySelector('.toast-region');
    if (!region) {
      region = document.createElement('div');
      region.className = 'toast-region';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.append(region);
    }
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    region.append(el);
    setTimeout(() => el.remove(), 3200);
  }

  // ---------- Dialogs ----------
  /**
   * Shows a small form dialog and resolves with the entered value (or null if cancelled).
   * `validate` may return an error string to keep the dialog open.
   */
  function promptDialog({ title, label, value = '', type = 'text', placeholder = '', confirmText = 'Save', validate, min, max }) {
    return new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.innerHTML = `
        <form method="dialog" novalidate>
          <h2>${esc(title)}</h2>
          <div class="field">
            <label for="pxDialogInput">${esc(label)}</label>
            <input class="input" id="pxDialogInput" type="${type}" placeholder="${esc(placeholder)}"
              ${min !== undefined ? `min="${min}"` : ''} ${max !== undefined ? `max="${max}"` : ''} autocomplete="off">
            <div class="hint" id="pxDialogError" role="alert"></div>
          </div>
          <div class="dialog-actions">
            <button class="btn btn-ghost" value="cancel" type="button">Cancel</button>
            <button class="btn" value="ok" type="submit">${esc(confirmText)}</button>
          </div>
        </form>`;
      document.body.append(dialog);
      const input = dialog.querySelector('input');
      const error = dialog.querySelector('#pxDialogError');
      input.value = value;
      let result = null;

      dialog.querySelector('[value="cancel"]').addEventListener('click', () => dialog.close());
      dialog.querySelector('form').addEventListener('submit', (e) => {
        const message = validate ? validate(input.value) : '';
        if (message) {
          e.preventDefault();
          error.textContent = message;
          error.style.color = 'var(--danger)';
          input.focus();
          return;
        }
        result = input.value;
      });
      dialog.addEventListener('close', () => {
        dialog.remove();
        resolve(result);
      });
      dialog.showModal();
      input.select();
    });
  }

  function confirmDialog({ title, message, confirmText = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.innerHTML = `
        <form method="dialog">
          <h2>${esc(title)}</h2>
          <p class="muted">${esc(message)}</p>
          <div class="dialog-actions">
            <button class="btn btn-ghost" value="cancel">Cancel</button>
            <button class="btn${danger ? ' btn-danger' : ''}" value="ok">${esc(confirmText)}</button>
          </div>
        </form>`;
      document.body.append(dialog);
      dialog.addEventListener('close', () => {
        const ok = dialog.returnValue === 'ok';
        dialog.remove();
        resolve(ok);
      });
      dialog.showModal();
    });
  }

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    renderLayout();
    startTracking();
  });

  window.PX = {
    store,
    esc,
    dateKey,
    timeAgo,
    param,
    toast,
    promptDialog,
    confirmDialog,
    getSubjects,
    addSubject,
    removeSubject,
    subjectMeta,
    getCompleted,
    setLessonComplete,
    getActivity,
    secondsToday,
    getGoalMinutes,
    setGoalMinutes,
    getStreak,
  };
})();
