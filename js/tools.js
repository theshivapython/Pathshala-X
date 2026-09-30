/* Tools page: calculator, focus timer, unit converter, quick notes. */

/**
 * Safe arithmetic evaluator (no eval). Supports + - * / ^ %, parentheses,
 * unary minus, π, and sqrt(). `%` directly after a number means "percent".
 */
function evaluateExpression(input) {
  const src = input.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  let pos = 0;

  const peek = () => src[pos];
  const fail = () => { throw new Error('Invalid expression'); };

  function parseNumber() {
    const match = src.slice(pos).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i);
    if (!match) fail();
    pos += match[0].length;
    return parseFloat(match[0]);
  }

  function parsePrimary() {
    const ch = peek();
    if (ch === '(') {
      pos++;
      const value = parseExpr();
      if (peek() === ')') pos++; // tolerate a missing final ')'
      return value;
    }
    if (ch === 'π') { pos++; return Math.PI; }
    if (src.startsWith('sqrt(', pos)) {
      pos += 5;
      const value = parseExpr();
      if (peek() === ')') pos++;
      if (value < 0) fail();
      return Math.sqrt(value);
    }
    if (ch !== undefined && /[\d.]/.test(ch)) return parseNumber();
    return fail();
  }

  function parsePostfix() {
    let value = parsePrimary();
    while (peek() === '%') { pos++; value /= 100; }
    // Implicit multiplication: 2π, 2(3), (2)(3), 2sqrt(4)
    while (peek() === '(' || peek() === 'π' || src.startsWith('sqrt(', pos)) {
      value *= parsePrimary();
    }
    return value;
  }

  function parseUnary() {
    if (peek() === '-') { pos++; return -parseUnary(); }
    if (peek() === '+') { pos++; return parseUnary(); }
    return parsePower();
  }

  function parsePower() {
    const base = parsePostfix();
    if (peek() === '^') {
      pos++;
      return Math.pow(base, parseUnary()); // right-associative
    }
    return base;
  }

  function parseTerm() {
    let value = parseUnary();
    while (peek() === '*' || peek() === '/') {
      const op = src[pos++];
      const rhs = parseUnary();
      if (op === '/' && rhs === 0) throw new Error('Cannot divide by 0');
      value = op === '*' ? value * rhs : value / rhs;
    }
    return value;
  }

  function parseExpr() {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = src[pos++];
      const rhs = parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  if (!src) return 0;
  const result = parseExpr();
  if (pos !== src.length || !Number.isFinite(result)) fail();
  return result;
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return 'Error';
  if (Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-6 && n !== 0)) return n.toExponential(6).replace(/\.?0+e/, 'e');
  return String(parseFloat(n.toPrecision(12)));
}

document.addEventListener('DOMContentLoaded', () => {
  // ---------------------------------------------------------------- Calculator
  const exprEl = document.getElementById('calcExpr');
  const resultEl = document.getElementById('calcResult');
  let expr = '';
  let lastAnswer = 0;
  let justEvaluated = false;

  const display = (s) => s.replace(/\*/g, '×').replace(/\//g, '÷').replace(/sqrt\(/g, '√(');

  function preview() {
    exprEl.textContent = expr ? display(expr) : ' ';
    if (!expr) { resultEl.textContent = '0'; return; }
    try {
      resultEl.textContent = formatNumber(evaluateExpression(expr));
      resultEl.style.color = '';
    } catch (e) {
      resultEl.style.color = 'var(--muted)';
    }
  }

  function press(key) {
    if (key === 'clear') {
      expr = '';
    } else if (key === 'back') {
      expr = expr.endsWith('sqrt(') ? expr.slice(0, -5) : expr.slice(0, -1);
    } else if (key === '=') {
      if (!expr) return;
      try {
        lastAnswer = evaluateExpression(expr);
        exprEl.textContent = `${display(expr)} =`;
        expr = formatNumber(lastAnswer);
        resultEl.textContent = expr;
        resultEl.style.color = '';
        justEvaluated = true;
      } catch (e) {
        resultEl.textContent = e.message === 'Cannot divide by 0' ? e.message : 'Error';
        resultEl.style.color = 'var(--danger)';
      }
      return;
    } else if (key === 'ans') {
      expr += formatNumber(lastAnswer);
    } else {
      // Typing a digit right after "=" starts a fresh calculation.
      if (justEvaluated && /^[\d.π]|sqrt/.test(key)) expr = '';
      expr += key;
    }
    justEvaluated = false;
    preview();
  }

  document.getElementById('calcKeys').addEventListener('click', (e) => {
    const key = e.target.closest('[data-k]');
    if (key) press(key.dataset.k);
  });

  document.addEventListener('keydown', (e) => {
    const target = e.target;
    if (target.matches('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    const map = { Enter: '=', '=': '=', Backspace: 'back', Escape: 'clear', Delete: 'clear', p: 'π', x: '*' };
    const key = map[e.key] || (/^[\d.+\-*/()^%]$/.test(e.key) ? e.key : null);
    if (!key) return;
    e.preventDefault();
    press(key);
  });

  // ---------------------------------------------------------------- Focus timer
  const MODES = {
    focus: { minutes: 25, label: 'Stay focused' },
    short: { minutes: 5, label: 'Short break' },
    long: { minutes: 15, label: 'Long break' },
  };
  const timeEl = document.getElementById('timerTime');
  const labelEl = document.getElementById('timerLabel');
  const ring = document.getElementById('timerRing');
  const startBtn = document.getElementById('timerStart');
  const modesEl = document.getElementById('timerModes');
  const sessionCountEl = document.getElementById('sessionCount');

  let mode = 'focus';
  let remaining = MODES.focus.minutes * 60;
  let endAt = null;
  let ticker = null;

  function renderSessions() {
    const sessions = PX.store.get('focusSessions', {});
    const n = sessions[PX.dateKey()] || 0;
    sessionCountEl.textContent = `${n} ${n === 1 ? 'session' : 'sessions'} today`;
  }

  function renderTimer() {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    timeEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    const total = MODES[mode].minutes * 60;
    ring.style.setProperty('--value', ((total - remaining) / total) * 100);
    labelEl.textContent = MODES[mode].label;
    document.title = endAt ? `${timeEl.textContent} · ${MODES[mode].label}` : 'Tools · Pathshala-X';
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.25, 0.5].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.2, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.2);
      });
    } catch (e) { /* audio unavailable */ }
  }

  function pause() {
    clearInterval(ticker);
    ticker = null;
    endAt = null;
    startBtn.textContent = '▶ Start';
    renderTimer();
  }

  function finish() {
    pause();
    beep();
    if (mode === 'focus') {
      const sessions = PX.store.get('focusSessions', {});
      const key = PX.dateKey();
      sessions[key] = (sessions[key] || 0) + 1;
      PX.store.set('focusSessions', sessions);
      renderSessions();
      PX.toast('🎉 Focus session done — take a short break!');
      setMode('short');
    } else {
      PX.toast('Break over — ready to focus?');
      setMode('focus');
    }
  }

  function tick() {
    remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    renderTimer();
    if (remaining === 0) finish();
  }

  function start() {
    endAt = Date.now() + remaining * 1000;
    ticker = setInterval(tick, 250);
    startBtn.textContent = '⏸ Pause';
    renderTimer();
  }

  function setMode(next) {
    pause();
    mode = next;
    remaining = MODES[mode].minutes * 60;
    modesEl.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    renderTimer();
  }

  startBtn.addEventListener('click', () => (ticker ? pause() : start()));
  document.getElementById('timerReset').addEventListener('click', () => setMode(mode));
  modesEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (btn) setMode(btn.dataset.mode);
  });

  renderSessions();
  renderTimer();

  // ---------------------------------------------------------------- Unit converter
  const UNITS = {
    Length: { m: ['Metre', 1], km: ['Kilometre', 1000], cm: ['Centimetre', 0.01], mm: ['Millimetre', 0.001], mi: ['Mile', 1609.344], ft: ['Foot', 0.3048], in: ['Inch', 0.0254] },
    Mass: { kg: ['Kilogram', 1], g: ['Gram', 0.001], mg: ['Milligram', 1e-6], t: ['Tonne', 1000], lb: ['Pound', 0.45359237], oz: ['Ounce', 0.028349523125] },
    Time: { s: ['Second', 1], min: ['Minute', 60], h: ['Hour', 3600], d: ['Day', 86400], wk: ['Week', 604800] },
    Speed: { 'm/s': ['Metre/second', 1], 'km/h': ['Kilometre/hour', 1 / 3.6], mph: ['Mile/hour', 0.44704] },
    Temperature: { C: ['Celsius'], F: ['Fahrenheit'], K: ['Kelvin'] },
  };
  const DEFAULT_PAIRS = { Length: ['km', 'm'], Mass: ['kg', 'g'], Time: ['h', 'min'], Speed: ['km/h', 'm/s'], Temperature: ['C', 'F'] };

  const catEl = document.getElementById('convCategories');
  const fromValue = document.getElementById('convFromValue');
  const toValue = document.getElementById('convToValue');
  const fromUnit = document.getElementById('convFromUnit');
  const toUnit = document.getElementById('convToUnit');
  const formulaEl = document.getElementById('convFormula');
  let category = 'Length';

  function toKelvin(v, u) {
    if (u === 'C') return v + 273.15;
    if (u === 'F') return ((v - 32) * 5) / 9 + 273.15;
    return v;
  }

  function fromKelvin(v, u) {
    if (u === 'C') return v - 273.15;
    if (u === 'F') return ((v - 273.15) * 9) / 5 + 32;
    return v;
  }

  function convert(value, from, to) {
    if (category === 'Temperature') return fromKelvin(toKelvin(value, from), to);
    const units = UNITS[category];
    return (value * units[from][1]) / units[to][1];
  }

  function renderConverter() {
    const value = parseFloat(fromValue.value);
    if (!Number.isFinite(value)) {
      toValue.value = '';
      formulaEl.textContent = 'Enter a number to convert.';
      return;
    }
    const result = convert(value, fromUnit.value, toUnit.value);
    toValue.value = formatNumber(result);
    formulaEl.textContent = `${formatNumber(value)} ${fromUnit.value} = ${formatNumber(result)} ${toUnit.value}`;
    if (category !== 'Temperature' && fromUnit.value !== toUnit.value && value !== 1) {
      formulaEl.textContent += `  ·  1 ${fromUnit.value} = ${formatNumber(convert(1, fromUnit.value, toUnit.value))} ${toUnit.value}`;
    }
  }

  function setCategory(next) {
    category = next;
    catEl.innerHTML = Object.keys(UNITS).map((c) => `<button type="button" class="chip${c === category ? ' active' : ''}" data-cat="${c}" aria-pressed="${c === category}">${c}</button>`).join('');
    const options = Object.entries(UNITS[category]).map(([k, [name]]) => `<option value="${k}">${name} (${k})</option>`).join('');
    fromUnit.innerHTML = options;
    toUnit.innerHTML = options;
    [fromUnit.value, toUnit.value] = DEFAULT_PAIRS[category];
    renderConverter();
  }

  catEl.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cat]');
    if (chip) setCategory(chip.dataset.cat);
  });
  [fromValue, fromUnit, toUnit].forEach((el) => el.addEventListener('input', renderConverter));
  document.getElementById('convSwap').addEventListener('click', () => {
    [fromUnit.value, toUnit.value] = [toUnit.value, fromUnit.value];
    renderConverter();
  });
  setCategory('Length');

  // ---------------------------------------------------------------- Notes
  const notes = document.getElementById('notes');
  const notesStatus = document.getElementById('notesStatus');
  const notesCount = document.getElementById('notesCount');
  let saveTimer = null;

  function renderCount() {
    const words = (notes.value.trim().match(/\S+/g) || []).length;
    notesCount.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
  }

  notes.value = PX.store.get('notes', '');
  renderCount();

  notes.addEventListener('input', () => {
    notesStatus.textContent = 'Saving…';
    renderCount();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      PX.store.set('notes', notes.value);
      notesStatus.textContent = 'Saved';
    }, 400);
  });

  document.getElementById('notesDownload').addEventListener('click', () => {
    if (!notes.value.trim()) {
      PX.toast('Nothing to download yet.');
      return;
    }
    const blob = new Blob([notes.value], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pathshala-notes-${PX.dateKey()}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  document.getElementById('notesClear').addEventListener('click', async () => {
    if (!notes.value) return;
    const ok = await PX.confirmDialog({ title: 'Clear notes?', message: 'This permanently deletes your notes from this browser.', confirmText: 'Clear notes', danger: true });
    if (!ok) return;
    notes.value = '';
    PX.store.set('notes', '');
    renderCount();
  });
});
