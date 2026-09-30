/* Login page: sign in, create account, demo account. */
document.addEventListener('DOMContentLoaded', () => {
  const { auth, esc } = PX;
  const next = auth.safeNext(PX.param('next'));

  if (auth.user()) {
    location.replace(next);
    return;
  }

  const form = document.getElementById('authForm');
  const tabSignin = document.getElementById('tabSignin');
  const tabSignup = document.getElementById('tabSignup');
  const nameField = document.getElementById('nameField');
  const nameEl = document.getElementById('name');
  const emailEl = document.getElementById('email');
  const passwordEl = document.getElementById('password');
  const rememberEl = document.getElementById('remember');
  const submitBtn = document.getElementById('submitBtn');
  const demoBtn = document.getElementById('demoBtn');
  const savedEl = document.getElementById('savedAccounts');
  const fields = { name: nameEl, email: emailEl, password: passwordEl };

  let mode = PX.param('mode') === 'signup' ? 'signup' : 'signin';

  function clearErrors() {
    Object.entries(fields).forEach(([key, el]) => {
      el.removeAttribute('aria-invalid');
      document.getElementById(`${key}Error`).textContent = '';
    });
  }

  function showError(field, message) {
    const el = fields[field] || passwordEl;
    el.setAttribute('aria-invalid', 'true');
    document.getElementById(`${field in fields ? field : 'password'}Error`).textContent = message;
    el.focus();
  }

  function renderSaved() {
    const accounts = Object.values(PX.raw.get('accounts', {}))
      .sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0))
      .slice(0, 3);
    if (mode !== 'signin' || !accounts.length) {
      savedEl.innerHTML = '';
      return;
    }
    savedEl.innerHTML = `
      <p class="small muted" style="margin-bottom:8px">Accounts on this device</p>
      <div class="saved-accounts">
        ${accounts.map((a) => `
          <button type="button" class="saved-account" data-email="${esc(a.email)}">
            <span class="avatar" aria-hidden="true">${esc(auth.initials(a.name))}</span>
            <span style="min-width:0">
              <strong class="truncate" style="display:block">${esc(a.name)}</strong>
              <span class="small muted truncate" style="display:block">${esc(a.email)}${a.lastLoginAt ? ` · last seen ${PX.timeAgo(a.lastLoginAt)}` : ''}</span>
            </span>
          </button>`).join('')}
      </div>
      <div class="divider" style="margin:16px 0 0">or use another account</div>`;
  }

  savedEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-email]');
    if (!btn) return;
    emailEl.value = btn.dataset.email;
    passwordEl.focus();
  });

  function setMode(nextMode) {
    mode = nextMode;
    const signup = mode === 'signup';
    tabSignin.setAttribute('aria-selected', String(!signup));
    tabSignup.setAttribute('aria-selected', String(signup));
    nameField.hidden = !signup;
    document.getElementById('authTitle').textContent = signup ? 'Create your account' : 'Welcome back';
    document.getElementById('authSubtitle').textContent = signup
      ? 'It takes 10 seconds. Your progress is saved to this account.'
      : 'Sign in to continue learning.';
    submitBtn.textContent = signup ? 'Create account' : 'Sign in';
    passwordEl.autocomplete = signup ? 'new-password' : 'current-password';
    const query = new URLSearchParams({ ...(signup ? { mode: 'signup' } : {}), ...(next !== 'index.html' ? { next } : {}) }).toString();
    history.replaceState(null, '', query ? `login.html?${query}` : 'login.html');
    clearErrors();
    renderSaved();
    (signup ? nameEl : emailEl).focus();
  }

  tabSignin.addEventListener('click', () => setMode('signin'));
  tabSignup.addEventListener('click', () => setMode('signup'));

  document.getElementById('togglePassword').addEventListener('click', (e) => {
    const show = passwordEl.type === 'password';
    passwordEl.type = show ? 'text' : 'password';
    e.currentTarget.textContent = show ? 'Hide' : 'Show';
    e.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  function setBusy(busy) {
    submitBtn.disabled = busy;
    demoBtn.disabled = busy;
  }

  function finish(result, welcome) {
    if (!result.ok) {
      showError(result.field, result.error);
      setBusy(false);
      return;
    }
    try { sessionStorage.setItem('px:welcome', welcome); } catch (e) { /* ignore */ }
    location.replace(next);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    setBusy(true);
    const payload = { name: nameEl.value, email: emailEl.value, password: passwordEl.value, remember: rememberEl.checked };
    if (mode === 'signin' && !emailEl.value.trim()) {
      setBusy(false);
      showError('email', 'Please enter your email.');
      return;
    }
    if (mode === 'signup') {
      const result = await auth.signUp(payload);
      finish(result, result.ok ? `Welcome to Pathshala-X, ${result.user.name.split(' ')[0]}! 🎉` : '');
    } else {
      const result = await auth.signIn(payload);
      finish(result, result.ok ? `Welcome back, ${result.user.name.split(' ')[0]}! 👋` : '');
    }
  });

  demoBtn.addEventListener('click', async () => {
    setBusy(true);
    const result = await auth.signInDemo();
    finish(result, 'You are using the demo account. Explore freely! 🎓');
  });

  setMode(mode);
});
