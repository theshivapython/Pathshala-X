/* Languages + speech: AI voice (/api/speech) with a fallback to the device's own voices. */
(function () {
  'use strict';

  // `code` is the BCP-47 tag used to pick a device voice; `rtl` flips text direction.
  const LANGUAGES = [
    { group: 'Indian languages', items: [
      { name: 'English', native: 'English', code: 'en-IN' },
      { name: 'Hindi', native: 'हिन्दी', code: 'hi-IN' },
      { name: 'Telugu', native: 'తెలుగు', code: 'te-IN' },
      { name: 'Tamil', native: 'தமிழ்', code: 'ta-IN' },
      { name: 'Kannada', native: 'ಕನ್ನಡ', code: 'kn-IN' },
      { name: 'Malayalam', native: 'മലയാളം', code: 'ml-IN' },
      { name: 'Marathi', native: 'मराठी', code: 'mr-IN' },
      { name: 'Bengali', native: 'বাংলা', code: 'bn-IN' },
      { name: 'Gujarati', native: 'ગુજરાતી', code: 'gu-IN' },
      { name: 'Punjabi', native: 'ਪੰਜਾਬੀ', code: 'pa-IN' },
      { name: 'Odia', native: 'ଓଡ଼ିଆ', code: 'or-IN' },
      { name: 'Urdu', native: 'اردو', code: 'ur-IN', rtl: true },
    ] },
    { group: 'World languages', items: [
      { name: 'Spanish', native: 'Español', code: 'es-ES' },
      { name: 'French', native: 'Français', code: 'fr-FR' },
      { name: 'German', native: 'Deutsch', code: 'de-DE' },
      { name: 'Portuguese', native: 'Português', code: 'pt-BR' },
      { name: 'Arabic', native: 'العربية', code: 'ar-SA', rtl: true },
      { name: 'Chinese', native: '中文', code: 'zh-CN' },
      { name: 'Japanese', native: '日本語', code: 'ja-JP' },
      { name: 'Korean', native: '한국어', code: 'ko-KR' },
      { name: 'Russian', native: 'Русский', code: 'ru-RU' },
      { name: 'Indonesian', native: 'Bahasa Indonesia', code: 'id-ID' },
      { name: 'Nepali', native: 'नेपाली', code: 'ne-NP' },
    ] },
  ];

  const ALL = LANGUAGES.flatMap((g) => g.items);

  /** Info for a language name; unknown (custom) languages get no device voice code. */
  function languageInfo(name) {
    return ALL.find((l) => l.name.toLowerCase() === String(name || '').toLowerCase())
      || { name: name || 'English', native: name || 'English', code: '', rtl: false };
  }

  /** Markdown → clean text to read aloud. */
  function plain(text) {
    return String(text || '')
      .replace(/\*\*|__|`/g, '')
      .replace(/^#+\s*/gm, '')
      .replace(/^\s*[-*•]\s+/gm, '')
      .replace(/\^/g, ' power ')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  // ---------- AI voice ----------
  let aiVoiceAvailable = null; // unknown until the first request

  async function fetchAiAudio(text, language) {
    if (aiVoiceAvailable === false) return null;
    try {
      const res = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 4000), language }),
      });
      const type = res.headers.get('Content-Type') || '';
      if (!res.ok || !type.startsWith('audio/')) {
        // 503 (no key) or a static host: stop asking for this page view.
        if (res.status === 503 || res.status === 404 || res.status === 405 || !type.startsWith('audio/')) aiVoiceAvailable = false;
        return null;
      }
      aiVoiceAvailable = true;
      return await res.blob();
    } catch (e) {
      aiVoiceAvailable = false;
      return null;
    }
  }

  // ---------- Device voice ----------
  const canSpeak = 'speechSynthesis' in window;

  function voices() {
    return canSpeak ? speechSynthesis.getVoices() : [];
  }
  if (canSpeak) speechSynthesis.addEventListener?.('voiceschanged', voices);

  function deviceVoice(code) {
    if (!code) return null;
    const list = voices();
    const base = code.split('-')[0].toLowerCase();
    return list.find((v) => v.lang.toLowerCase() === code.toLowerCase())
      || list.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(`${base}-`) || v.lang.toLowerCase() === base)
      || null;
  }

  /** Speaks with the device voice; resolves when finished (or after a safety timeout). */
  function speakDevice(text, code, { rate = 1 } = {}) {
    return new Promise((resolve) => {
      if (!canSpeak || !text) return resolve(false);
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = deviceVoice(code);
      if (voice) utterance.voice = voice;
      if (code) utterance.lang = code;
      utterance.rate = rate;
      let done = false;
      const finish = (ok) => { if (!done) { done = true; clearTimeout(timer); resolve(ok); } };
      // Some browsers never fire `end` (e.g. no voices installed) — don't hang forever.
      const timer = setTimeout(() => finish(false), Math.max(4000, text.length * 120));
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      speechSynthesis.speak(utterance);
    });
  }

  // ---------- Listen buttons ----------
  let current = null; // { button, audio?, stop }

  function setButton(button, playing, label) {
    if (!button) return;
    button.textContent = playing ? '⏹ Stop' : (label || '🔊 Listen');
    button.setAttribute('aria-pressed', String(playing));
  }

  function stop() {
    if (!current) return;
    const { button, stop: stopFn } = current;
    current = null;
    stopFn();
    setButton(button, false);
  }

  const audioCache = new Map(); // text+language → object URL

  /**
   * Toggles reading `text` aloud for a Listen button.
   * Uses the AI voice when available, otherwise the device voice.
   */
  async function toggle(button, text, languageName) {
    if (current && current.button === button) {
      stop();
      return;
    }
    stop();
    const info = languageInfo(languageName);
    const clean = plain(text);
    const session = { button, stop: () => {} };
    current = session;
    button.disabled = true;
    button.textContent = '⏳ Loading…';

    const key = `${info.name}\n${clean}`;
    let url = audioCache.get(key);
    if (!url) {
      const blob = await fetchAiAudio(clean, info.name);
      if (blob) {
        url = URL.createObjectURL(blob);
        audioCache.set(key, url);
      }
    }
    button.disabled = false;
    if (current !== session) return; // user started something else meanwhile

    if (url) {
      const audio = new Audio(url);
      session.stop = () => { audio.pause(); audio.currentTime = 0; };
      audio.onended = () => { if (current === session) { current = null; setButton(button, false); } };
      setButton(button, true);
      audio.play().catch(() => { current = null; setButton(button, false); });
      return;
    }

    if (!canSpeak) {
      current = null;
      setButton(button, false);
      PX.toast('Your browser cannot read text aloud.');
      return;
    }
    if (info.code && !deviceVoice(info.code)) {
      PX.toast(`No ${info.name} voice found on this device — it may read with a different accent.`);
    }
    session.stop = () => speechSynthesis.cancel();
    setButton(button, true);
    speechSynthesis.cancel();
    speakDevice(clean, info.code).then(() => {
      if (current === session) { current = null; setButton(button, false); }
    });
  }

  window.addEventListener('beforeunload', () => {
    if (canSpeak) speechSynthesis.cancel();
  });

  window.PXSpeech = {
    LANGUAGES,
    languageInfo,
    plain,
    fetchAiAudio,
    deviceVoice,
    speakDevice,
    canSpeak,
    toggle,
    stop,
    get aiVoiceAvailable() { return aiVoiceAvailable; },
  };
})();
