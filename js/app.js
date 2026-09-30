/* Pathshala-X shared runtime: layout, theme, storage, study tracking, UI helpers. */
(function () {
  'use strict';

  const PREFIX = 'px:';

  // ---------- Raw (device-wide) storage ----------
  const raw = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(PREFIX + key);
        return value === null ? fallback : JSON.parse(value);
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

  // ---------- Demo accounts ----------
  // TEMPORARY: accounts live in this browser's localStorage only. This is a demo
  // until a real backend + database replaces it — do not treat it as secure.
  const SESSION_KEY = PREFIX + 'session';
  const DEMO_EMAIL = 'demo@pathshala.app';
  const DEMO_PASSWORD = 'demo1234';
  // Per-user data keys. Before accounts existed these were stored un-namespaced;
  // the first account created on a device adopts that data.
  const USER_KEYS = ['completed', 'lastLesson', 'activity', 'goalMinutes', 'customSubjects', 'history', 'notes', 'focusSessions'];

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY));
    } catch (e) {
      return null;
    }
  }

  function writeSession(session, remember) {
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      if (session) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) { /* ignore */ }
  }

  const getAccounts = () => raw.get('accounts', {});
  const saveAccounts = (accounts) => raw.set('accounts', accounts);

  let currentUser = (() => {
    const session = readSession();
    const account = session && getAccounts()[session.userId];
    return account || null;
  })();

  function publicUser(account) {
    if (!account) return null;
    const { salt, hash, ...rest } = account;
    return { ...rest, isDemo: account.email === DEMO_EMAIL };
  }

  function toHex(buffer) {
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function randomId(bytes = 16) {
    const arr = new Uint8Array(bytes);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(arr) : arr.forEach((_, i) => { arr[i] = Math.random() * 256; });
    return toHex(arr);
  }

  async function hashPassword(password, salt) {
    if (window.crypto && crypto.subtle) {
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256
      );
      return `pbkdf2:${toHex(bits)}`;
    }
    // Insecure contexts (plain http on a LAN IP) have no WebCrypto — fall back to a simple hash.
    let h = 2166136261;
    const input = `${salt}:${password}`;
    for (let round = 0; round < 1000; round++) {
      for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619) >>> 0;
    }
    return `fnv:${h.toString(16)}`;
  }

  function deviceLabel() {
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
      : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows'
      : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
    return `${browser} on ${os}`;
  }

  function userKey(userId, key) {
    return `u:${userId}:${key}`;
  }

  function adoptLegacyData(userId) {
    if (raw.get('legacyAdopted')) return;
    USER_KEYS.forEach((key) => {
      const value = raw.get(key);
      if (value !== undefined) {
        raw.set(userKey(userId, key), value);
        raw.remove(key);
      }
    });
    raw.set('legacyAdopted', true);
  }

  function startSession(account, remember) {
    const accounts = getAccounts();
    const stored = accounts[account.id];
    stored.previousLoginAt = stored.lastLoginAt || null;
    stored.lastLoginAt = Date.now();
    stored.logins = [{ ts: stored.lastLoginAt, device: deviceLabel() }, ...(stored.logins || [])].slice(0, 15);
    saveAccounts(accounts);
    writeSession({ userId: account.id, since: Date.now() }, remember);
    currentUser = stored;
    return publicUser(stored);
  }

  function findByEmail(email) {
    const target = String(email || '').trim().toLowerCase();
    return Object.values(getAccounts()).find((a) => a.email === target) || null;
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function signUp({ name, email, password, remember = true }) {
    const cleanName = String(name || '').trim().replace(/\s+/g, ' ');
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanName || cleanName.length > 40) return { ok: false, field: 'name', error: 'Please enter your name (up to 40 characters).' };
    if (!EMAIL_RE.test(cleanEmail)) return { ok: false, field: 'email', error: 'Please enter a valid email address.' };
    if (String(password || '').length < 6) return { ok: false, field: 'password', error: 'Password must be at least 6 characters.' };
    if (findByEmail(cleanEmail)) return { ok: false, field: 'email', error: 'An account with this email already exists. Sign in instead.' };

    const id = randomId(8);
    const salt = randomId(16);
    const accounts = getAccounts();
    accounts[id] = {
      id, name: cleanName, email: cleanEmail, salt,
      hash: await hashPassword(password, salt),
      createdAt: Date.now(), lastLoginAt: null, previousLoginAt: null, logins: [],
    };
    saveAccounts(accounts);
    if (cleanEmail !== DEMO_EMAIL) adoptLegacyData(id);
    return { ok: true, user: startSession(accounts[id], remember) };
  }

  async function signIn({ email, password, remember = true }) {
    const account = findByEmail(email);
    // Same message for unknown email and wrong password so accounts can't be probed.
    const fail = { ok: false, field: 'password', error: 'Incorrect email or password.' };
    if (!account) return fail;
    if ((await hashPassword(String(password || ''), account.salt)) !== account.hash) return fail;
    return { ok: true, user: startSession(account, remember) };
  }

  function daysAgo(n, hour = 17) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour, 0, 0, 0);
    return d;
  }

  function seedDemoData(userId) {
    const set = (key, value) => raw.set(userKey(userId, key), value);
    const activity = {};
    [[1, 24], [2, 31], [3, 18], [4, 0], [5, 27], [6, 12], [8, 22], [9, 15]].forEach(([n, min]) => {
      if (min) activity[dateKey(daysAgo(n))] = min * 60;
    });
    set('activity', activity);
    set('completed', {
      'math-pythagoras': daysAgo(5).getTime(),
      'physics-newton-laws': daysAgo(3).getTime(),
      'bio-cell': daysAgo(2).getTime(),
      'math-pi-circles': daysAgo(1).getTime(),
    });
    set('lastLesson', 'math-linear-equations');
    set('focusSessions', { [dateKey(daysAgo(2))]: 2, [dateKey(daysAgo(1))]: 1 });
    set('history', [
      {
        id: 'demo-2', ts: daysAgo(1, 18).getTime(), subject: 'Chemistry', level: 'student', source: 'ai',
        question: 'Why does ice float on water?', answer: '',
        explanation: '**Ice is less dense than liquid water.**\n\n- When water freezes, its molecules line up in an open, hexagonal pattern held by hydrogen bonds.\n- That pattern takes up more space, so the same mass fills a bigger volume.\n- Anything less dense than water floats on it.\n\n**In one line:** Freezing spreads water molecules apart, so ice is lighter for its size and floats.',
      },
      {
        id: 'demo-1', ts: daysAgo(3, 16).getTime(), subject: 'Math', level: 'simple', source: 'ai',
        question: 'What does the slope of a line mean?', answer: 'Slope is rise over run.',
        explanation: '**Slope tells you how steep a line is.**\n\n1. Pick two points on the line.\n2. **Rise** = how far up you go. **Run** = how far across you go.\n3. Slope = rise ÷ run.\n\nA slope of 2 means: every 1 step right, the line goes 2 steps up.\n\n**In one line:** Slope is how much a line goes up for each step across.',
      },
    ]);
    set('notes', 'Formulas to revise:\n- a² + b² = c²\n- Area of circle = πr²\n- F = ma');
  }

  async function signInDemo() {
    let account = findByEmail(DEMO_EMAIL);
    if (!account) {
      const created = await signUp({ name: 'Demo Student', email: DEMO_EMAIL, password: DEMO_PASSWORD, remember: false });
      if (!created.ok) return created;
      seedDemoData(created.user.id);
      return created;
    }
    return signIn({ email: DEMO_EMAIL, password: DEMO_PASSWORD, remember: false });
  }

  function signOut() {
    writeSession(null);
    currentUser = null;
    location.href = 'login.html';
  }

  function updateName(name) {
    const clean = String(name || '').trim().replace(/\s+/g, ' ');
    if (!clean || clean.length > 40) return { ok: false, error: 'Please enter a name (up to 40 characters).' };
    const accounts = getAccounts();
    accounts[currentUser.id].name = clean;
    saveAccounts(accounts);
    currentUser = accounts[currentUser.id];
    return { ok: true };
  }

  async function changePassword(current, next) {
    const accounts = getAccounts();
    const account = accounts[currentUser.id];
    if ((await hashPassword(String(current || ''), account.salt)) !== account.hash) {
      return { ok: false, error: 'Your current password is incorrect.' };
    }
    if (String(next || '').length < 6) return { ok: false, error: 'New password must be at least 6 characters.' };
    account.salt = randomId(16);
    account.hash = await hashPassword(next, account.salt);
    saveAccounts(accounts);
    currentUser = account;
    return { ok: true };
  }

  function userDataKeys(userId) {
    const prefix = `${PREFIX}u:${userId}:`;
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(prefix)) keys.push(k);
      }
    } catch (e) { /* ignore */ }
    return keys;
  }

  function exportUserData() {
    const prefix = `${PREFIX}u:${currentUser.id}:`;
    const data = {};
    userDataKeys(currentUser.id).forEach((k) => {
      try { data[k.slice(prefix.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* skip */ }
    });
    return { exportedAt: new Date().toISOString(), account: publicUser(currentUser), data };
  }

  function deleteAccount() {
    const id = currentUser.id;
    userDataKeys(id).forEach((k) => localStorage.removeItem(k));
    const accounts = getAccounts();
    delete accounts[id];
    saveAccounts(accounts);
    signOut();
  }

  function safeNext(value) {
    // Only allow local page names, never external URLs.
    return value && /^[a-z]+\.html(\?[^#]*)?$/i.test(value) && !/^login\.html/i.test(value) ? value : 'index.html';
  }

  // ---------- Per-user storage ----------
  const store = {
    get(key, fallback) {
      return currentUser ? raw.get(userKey(currentUser.id, key), fallback) : fallback;
    },
    set(key, value) {
      if (currentUser) raw.set(userKey(currentUser.id, key), value);
    },
    remove(key) {
      if (currentUser) raw.remove(userKey(currentUser.id, key));
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
      if (Array.isArray(legacy) && raw.get('customSubjects') === undefined) {
        const defaults = DEFAULT_SUBJECTS.map((s) => s.name);
        raw.set('customSubjects', legacy.filter((s) => typeof s === 'string' && !defaults.includes(s)));
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
    raw.set('theme', theme);
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
    { id: 'account', href: 'account.html', icon: '👤', label: 'My account' },
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
        <div class="user-card">
          <a class="user-link" href="account.html" title="My account">
            <span class="avatar" aria-hidden="true">${esc(initials(currentUser.name))}</span>
            <span class="user-meta">
              <strong class="truncate">${esc(currentUser.name)}</strong>
              <span class="truncate">${esc(currentUser.email)}</span>
            </span>
          </a>
          <button class="signout-btn" id="signOutBtn" type="button" title="Sign out" aria-label="Sign out">⎋</button>
        </div>
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

    document.getElementById('signOutBtn').addEventListener('click', signOut);
    document.getElementById('themeToggle').addEventListener('click', () => {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
    renderThemeButton();
    renderMiniGoal();
    document.addEventListener('px:activity', renderMiniGoal);
  }

  function initials(name) {
    return String(name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
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
  const isPublicPage = () => document.body && document.body.hasAttribute('data-public');

  document.addEventListener('DOMContentLoaded', () => {
    if (isPublicPage()) return;
    if (!currentUser) {
      // Session missing or points at a deleted account (boot.js catches the common case earlier).
      writeSession(null);
      const here = (location.pathname.split('/').pop() || 'index.html') + location.search;
      location.replace(`login.html?next=${encodeURIComponent(here)}`);
      return;
    }
    renderLayout();
    startTracking();
    try {
      const welcome = sessionStorage.getItem('px:welcome');
      if (welcome) {
        sessionStorage.removeItem('px:welcome');
        toast(welcome);
      }
    } catch (e) { /* ignore */ }
  });

  // Keep tabs in sync: signing out (or in as someone else) in one tab applies to all.
  window.addEventListener('storage', (e) => {
    if (e.key !== SESSION_KEY || isPublicPage()) return;
    const session = readSession();
    if (!session || !currentUser || session.userId !== currentUser.id) location.reload();
  });

  window.PX = {
    store,
    raw,
    auth: {
      user: () => publicUser(currentUser),
      signUp,
      signIn,
      signInDemo,
      signOut,
      updateName,
      changePassword,
      exportUserData,
      deleteAccount,
      safeNext,
      initials,
      DEMO_EMAIL,
      DEMO_PASSWORD,
    },
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
