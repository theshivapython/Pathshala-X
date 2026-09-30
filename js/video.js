/*
 * Explainer video maker. Turns an explanation into animated slides with narration,
 * drawn on a <canvas> and recorded in the browser (MediaRecorder) into a video file.
 *
 * Narration: AI voice (/api/speech) is mixed into the recording. Without it, the
 * device voice reads along during playback, but browsers can't record device voices,
 * so the downloaded video is silent (the text is on screen).
 */
(function () {
  'use strict';

  const W = 1280;
  const H = 720;
  const PAD = 84;
  const FONT = 'Inter, "Noto Sans", "Nirmala UI", "Segoe UI", system-ui, sans-serif';
  const MAX_SCENES = 9;

  // ---------- Script ----------
  const strip = (s) => String(s || '').replace(/\*\*|__|`/g, '').replace(/^#+\s*/, '').trim();

  function parseBlocks(markdown) {
    const blocks = [];
    let list = null;
    String(markdown || '').replace(/\r/g, '').split('\n').forEach((raw) => {
      const line = raw.trim();
      const item = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (item) {
        if (!list) { list = { type: 'list', items: [] }; blocks.push(list); }
        list.items.push(item[1]);
        return;
      }
      list = null;
      if (line) blocks.push({ type: 'p', text: line.replace(/^#+\s*/, '') });
    });
    return blocks;
  }

  /** Builds scenes: intro (the question), content scenes, and a closing summary. */
  function buildScenes({ question, explanation }) {
    const blocks = parseBlocks(explanation);
    const scenes = [];
    const questionText = strip(question) || 'Your question';
    scenes.push({ kind: 'intro', heading: questionText, lines: [], narration: questionText });

    // The last "**Label:** text" paragraph is the summary (label is translated in other languages).
    let summaryIndex = -1;
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (blocks[i].type === 'p' && /^\*\*[^*]{1,40}[:：]\s*\*\*/.test(blocks[i].text)) { summaryIndex = i; break; }
    }

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (i === summaryIndex) continue;
      const fullyBold = block.type === 'p' && /^\*\*[^*]+\*\*[.:：]?$/.test(block.text);
      if (fullyBold && blocks[i + 1] && blocks[i + 1].type === 'list') {
        const heading = strip(block.text);
        chunk(blocks[i + 1].items, 3).forEach((items, n) => {
          scenes.push(listScene(n ? `${heading} (${n + 1})` : heading, items));
        });
        i++;
      } else if (block.type === 'list') {
        chunk(block.items, 3).forEach((items) => scenes.push(listScene('', items)));
      } else if (fullyBold) {
        scenes.push({ kind: 'title', heading: strip(block.text), lines: [], narration: strip(block.text) });
      } else {
        scenes.push({ kind: 'text', heading: '', lines: [strip(block.text)], narration: strip(block.text) });
      }
    }

    // Keep videos short: merge neighbouring plain-text scenes until under the limit.
    while (scenes.length > MAX_SCENES - (summaryIndex >= 0 ? 1 : 0)) {
      const i = scenes.findIndex((s, n) => n > 0 && s.kind === 'text' && scenes[n + 1] && scenes[n + 1].kind === 'text');
      if (i === -1) { scenes.splice(MAX_SCENES - 1); break; }
      scenes[i].lines.push(...scenes[i + 1].lines);
      scenes[i].narration += ` ${scenes[i + 1].narration}`;
      scenes.splice(i + 1, 1);
    }

    if (summaryIndex >= 0) {
      const text = blocks[summaryIndex].text;
      const label = strip(text.match(/^\*\*([^*]+?)[:：]?\s*\*\*/)[1]);
      const body = strip(text.replace(/^\*\*[^*]+\*\*\s*/, ''));
      scenes.push({ kind: 'summary', heading: label, lines: [body], narration: `${label}: ${body}` });
    }
    return scenes;
  }

  function listScene(heading, items) {
    const lines = items.map(strip);
    return { kind: 'list', heading, lines, narration: [heading, ...lines].filter(Boolean).join('. ') };
  }

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  const estimateSeconds = (text) => Math.max(3.5, String(text).length / 13 + 1.2);

  // ---------- Drawing ----------
  function wrap(ctx, text, maxWidth) {
    const tokens = String(text).split(/(\s+)/).filter((t) => t.length);
    const lines = [];
    let line = '';
    const push = () => { if (line.trim()) lines.push(line.trim()); line = ''; };
    tokens.forEach((token) => {
      if (ctx.measureText(line + token).width <= maxWidth) {
        line += token;
        return;
      }
      if (ctx.measureText(token.trim()).width <= maxWidth) {
        push();
        line = token.trimStart();
        return;
      }
      // Token wider than a line (long word, or scripts without spaces): break by character.
      [...token].forEach((ch) => {
        if (ctx.measureText(line + ch).width > maxWidth) push();
        line += ch;
      });
    });
    push();
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

  /** Lays out a scene's text, shrinking the font until it fits. */
  function layout(ctx, scene, rtl) {
    const width = W - PAD * 2 - (scene.kind === 'list' ? 46 : 0);
    for (let size = scene.kind === 'intro' ? 54 : 36; size >= 22; size -= 2) {
      const headingSize = scene.kind === 'intro' ? size : Math.round(size * 1.25);
      ctx.font = `700 ${headingSize}px ${FONT}`;
      const heading = scene.heading ? wrap(ctx, scene.heading, W - PAD * 2) : [];
      ctx.font = `${scene.kind === 'summary' ? 600 : 400} ${size}px ${FONT}`;
      const items = scene.lines.map((l) => wrap(ctx, l, scene.kind === 'summary' ? width - 60 : width));
      const bodyLines = items.reduce((n, l) => n + l.length, 0);
      const height = heading.length * headingSize * 1.25 + (heading.length ? 34 : 0)
        + bodyLines * size * 1.5 + (items.length - 1) * size * 0.6;
      if (height <= H - 250 || size === 22) return { size, headingSize, heading, items, height, rtl };
    }
    return null;
  }

  function draw(ctx, state) {
    const { scene, t, dur, index, total, progress, meta, lay } = state;
    const rtl = lay.rtl;
    ctx.save();
    ctx.direction = rtl ? 'rtl' : 'ltr';

    // Background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(1, '#0b1020');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * 0.85, H * 0.9, 20, W * 0.85, H * 0.9, 520);
    glow.addColorStop(0, 'rgba(20,184,166,0.28)');
    glow.addColorStop(1, 'rgba(20,184,166,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Header
    ctx.textBaseline = 'middle';
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6366f1';
    roundRect(ctx, PAD, 36, 34, 34, 9);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `800 18px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('P', PAD + 17, 54);
    ctx.textAlign = 'left';
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText('Pathshala-X', PAD + 46, 54);
    ctx.textAlign = 'right';
    ctx.font = `500 18px ${FONT}`;
    ctx.fillStyle = 'rgba(226,232,240,0.75)';
    ctx.fillText(meta, W - PAD, 54);
    ctx.direction = rtl ? 'rtl' : 'ltr';

    // Body
    const x = rtl ? W - PAD : PAD;
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.textBaseline = 'alphabetic';
    const intro = scene.kind === 'intro';
    let y = intro ? (H - lay.height) / 2 + lay.headingSize * 0.4 : Math.max(150, (H - lay.height) / 2 - 20);

    if (intro) {
      const a = ease(t / 0.6);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#5eead4';
      ctx.font = `700 20px ${FONT}`;
      ctx.fillText('QUESTION', x, y - lay.headingSize - 10);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${lay.headingSize}px ${FONT}`;
    lay.heading.forEach((line, i) => {
      const a = ease((t - i * 0.12) / 0.5);
      ctx.globalAlpha = a;
      ctx.fillText(line, x, y + (1 - a) * 14);
      y += lay.headingSize * 1.25;
    });
    if (lay.heading.length) y += 34;

    // Reveal body lines across the first ~60% of the scene.
    const totalLines = Math.max(1, lay.items.reduce((n, l) => n + l.length, 0));
    const step = Math.min(1.1, (dur * 0.6) / totalLines);
    let n = 0;

    if (scene.kind === 'summary') {
      const boxH = lay.items[0].length * lay.size * 1.5 + 44;
      ctx.globalAlpha = ease(t / 0.5);
      ctx.fillStyle = 'rgba(20,184,166,0.16)';
      roundRect(ctx, PAD, y - lay.size - 6, W - PAD * 2, boxH, 16);
      ctx.fill();
      ctx.fillStyle = '#2dd4bf';
      ctx.fillRect(rtl ? W - PAD - 6 : PAD, y - lay.size - 6, 6, boxH);
      y += 8;
    }

    ctx.font = `${scene.kind === 'summary' ? 600 : 400} ${lay.size}px ${FONT}`;
    lay.items.forEach((lines, itemIndex) => {
      lines.forEach((line, li) => {
        const a = ease((t - 0.35 - n * step) / 0.45);
        ctx.globalAlpha = a;
        const shift = (1 - a) * 18;
        let lx = x;
        if (scene.kind === 'list') {
          if (li === 0) {
            ctx.fillStyle = '#818cf8';
            ctx.beginPath();
            ctx.arc(rtl ? x - 12 : x + 12, y - lay.size * 0.34 + shift, 8, 0, Math.PI * 2);
            ctx.fill();
          }
          lx = rtl ? x - 46 : x + 46;
        } else if (scene.kind === 'summary') {
          lx = rtl ? x - 34 : x + 34;
        }
        ctx.fillStyle = scene.kind === 'summary' ? '#ccfbf1' : '#e2e8f0';
        ctx.fillText(line, lx, y + shift);
        y += lay.size * 1.5;
        n++;
      });
      if (itemIndex < lay.items.length - 1) y += lay.size * 0.6;
    });

    // Footer: scene counter + overall progress
    ctx.globalAlpha = 1;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `600 16px ${FONT}`;
    ctx.fillStyle = 'rgba(226,232,240,0.7)';
    ctx.fillText(`${index + 1} / ${total}`, PAD, H - 44);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, PAD + 70, H - 48, W - PAD * 2 - 70, 8, 4);
    ctx.fill();
    const grad = ctx.createLinearGradient(PAD + 70, 0, W - PAD, 0);
    grad.addColorStop(0, '#818cf8');
    grad.addColorStop(1, '#2dd4bf');
    ctx.fillStyle = grad;
    roundRect(ctx, PAD + 70, H - 48, Math.max(8, (W - PAD * 2 - 70) * progress), 8, 4);
    ctx.fill();
    ctx.restore();
  }

  // ---------- Recording helpers ----------
  function pickMime() {
    if (!window.MediaRecorder) return null;
    return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      .find((m) => MediaRecorder.isTypeSupported(m)) || '';
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function fmtDuration(sec) {
    const s = Math.round(sec);
    return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`;
  }

  function slug(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'explanation';
  }

  // ---------- Dialog ----------
  function open({ question, subject, language, explanation }) {
    PXSpeech.stop();
    const info = PXSpeech.languageInfo(language);
    const scenes = buildScenes({ question, explanation });
    const meta = [subject && subject !== 'General' ? subject : null, info.native].filter(Boolean).join(' · ');
    const mime = pickMime();
    let estimate = scenes.reduce((sum, s) => sum + estimateSeconds(s.narration) + 0.6, 0);

    const dialog = document.createElement('dialog');
    dialog.className = 'video-dialog';
    dialog.innerHTML = `
      <div class="video-inner">
        <div class="card-title" style="margin:0">
          <h2>🎬 Explainer video</h2>
          <button class="icon-btn" type="button" data-close aria-label="Close">✕</button>
        </div>
        <div class="video-stage">
          <canvas width="${W}" height="${H}" aria-label="Video preview"></canvas>
          <video controls playsinline hidden></video>
        </div>
        <p class="small muted" data-status>${scenes.length} scenes · about ${fmtDuration(estimate)} · narrated in ${PX.esc(info.name)}</p>
        <div class="row" data-actions>
          <button class="btn" type="button" data-start>▶ Create video</button>
          <button class="btn btn-ghost" type="button" data-stop hidden>⏹ Stop</button>
          <a class="btn btn-soft" data-download hidden>⬇ Download video</a>
          <button class="btn btn-ghost" type="button" data-again hidden>↺ Make again</button>
        </div>
        <p class="hint" data-note>The video plays while it's being made. Keep this tab open until it finishes.</p>
      </div>`;
    document.body.append(dialog);

    const canvas = dialog.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const videoEl = dialog.querySelector('video');
    const status = dialog.querySelector('[data-status]');
    const note = dialog.querySelector('[data-note]');
    const startBtn = dialog.querySelector('[data-start]');
    const stopBtn = dialog.querySelector('[data-stop]');
    const downloadBtn = dialog.querySelector('[data-download]');
    const againBtn = dialog.querySelector('[data-again]');
    const layouts = scenes.map((s) => layout(ctx, s, info.rtl));

    let run = null; // active run state
    let videoUrl = null;

    const drawStill = (i, t = 99) => draw(ctx, {
      scene: scenes[i], t, dur: 4, index: i, total: scenes.length, progress: (i + 1) / scenes.length, meta, lay: layouts[i],
    });
    drawStill(0);

    function reset() {
      canvas.hidden = false;
      videoEl.hidden = true;
      startBtn.hidden = false;
      stopBtn.hidden = true;
      downloadBtn.hidden = true;
      againBtn.hidden = true;
      drawStill(0);
    }

    async function prepareNarration(audioCtx) {
      // Try AI voice for the first scene; if unavailable, fall back to the device voice.
      const buffers = new Array(scenes.length).fill(null);
      if (PXSpeech.aiVoiceAvailable === false) return null;
      let done = 0;
      const load = async (i) => {
        const blob = await PXSpeech.fetchAiAudio(scenes[i].narration, info.name);
        if (!blob) throw new Error('no-ai-voice');
        buffers[i] = await audioCtx.decodeAudioData(await blob.arrayBuffer());
        done++;
        status.textContent = `Preparing AI narration… ${done} / ${scenes.length}`;
      };
      try {
        status.textContent = `Preparing AI narration… 0 / ${scenes.length}`;
        await load(0);
        const queue = scenes.map((_, i) => i).slice(1);
        const workers = Array.from({ length: 3 }, async () => {
          while (queue.length) {
            if (run?.cancelled) return;
            await load(queue.shift());
          }
        });
        await Promise.all(workers);
        return buffers;
      } catch (e) {
        return null;
      }
    }

    async function start() {
      if (run) return;
      PXSpeech.stop();
      const state = { cancelled: false, sources: [] };
      run = state;
      startBtn.hidden = true;
      stopBtn.hidden = false;
      downloadBtn.hidden = true;
      againBtn.hidden = true;
      canvas.hidden = false;
      videoEl.hidden = true;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = AudioCtx ? new AudioCtx() : null; // created during the click so it may play
      state.audioCtx = audioCtx;
      const buffers = audioCtx ? await prepareNarration(audioCtx) : null;
      if (state.cancelled) return;

      const useAi = Boolean(buffers);
      const deviceVoice = !useAi && PXSpeech.canSpeak;
      const durations = scenes.map((s, i) => (useAi ? buffers[i].duration + 0.7 : estimateSeconds(s.narration) + 0.6));
      const totalDur = durations.reduce((a, b) => a + b, 0);

      // Recording setup
      let recorder = null;
      const chunks = [];
      if (mime !== null) {
        const stream = canvas.captureStream(30);
        let dest = null;
        if (useAi) {
          dest = audioCtx.createMediaStreamDestination();
          dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
        }
        state.dest = dest;
        try {
          recorder = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 3_000_000 });
          recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
          recorder.start(250);
        } catch (e) {
          recorder = null;
        }
      }

      note.textContent = useAi
        ? 'Recording with AI narration. Keep this tab open until it finishes.'
        : deviceVoice
          ? 'Your device voice is reading along. Browsers can’t record device voices, so the downloaded video will be silent with the text on screen. Add an OpenAI key on the server for narrated videos.'
          : 'No voice is available, so this video has on-screen text only.';
      if (!recorder) note.textContent += ' This browser can’t record video, so it will play here only.';

      // Draw loop
      let sceneIndex = 0;
      let sceneStart = performance.now();
      let elapsedBefore = 0;
      const tick = () => {
        if (state.cancelled || state.finished) return;
        const t = (performance.now() - sceneStart) / 1000;
        const dur = durations[sceneIndex];
        draw(ctx, {
          scene: scenes[sceneIndex], t, dur, index: sceneIndex, total: scenes.length,
          progress: Math.min(1, (elapsedBefore + Math.min(t, dur)) / totalDur), meta, lay: layouts[sceneIndex],
        });
        state.frame = requestAnimationFrame(tick);
      };
      tick();

      for (sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
        if (state.cancelled) break;
        sceneStart = performance.now();
        status.textContent = `Scene ${sceneIndex + 1} of ${scenes.length} · about ${fmtDuration(Math.max(0, totalDur - elapsedBefore))} left`;
        const minTime = sleep(durations[sceneIndex] * 1000);
        if (useAi) {
          const source = audioCtx.createBufferSource();
          source.buffer = buffers[sceneIndex];
          source.connect(state.dest);
          source.connect(audioCtx.destination);
          source.start();
          state.sources.push(source);
          await minTime;
        } else if (deviceVoice) {
          speechSynthesis.cancel();
          await Promise.all([minTime, PXSpeech.speakDevice(scenes[sceneIndex].narration, info.code)]);
          await sleep(300);
        } else {
          await minTime;
        }
        elapsedBefore += durations[sceneIndex];
      }
      sceneIndex = Math.min(sceneIndex, scenes.length - 1);
      if (state.cancelled) return;

      await sleep(400);
      state.finished = true;
      cancelAnimationFrame(state.frame);
      drawStill(scenes.length - 1);

      if (recorder) {
        await new Promise((resolve) => { recorder.onstop = resolve; recorder.stop(); });
        const type = recorder.mimeType || mime || 'video/webm';
        const blob = new Blob(chunks, { type });
        if (videoUrl) URL.revokeObjectURL(videoUrl);
        videoUrl = URL.createObjectURL(blob);
        // Recorded WebM files have no duration header; seeking to the end once makes
        // the browser compute it so the player's seek bar works.
        videoEl.addEventListener('loadedmetadata', function fixDuration() {
          videoEl.removeEventListener('loadedmetadata', fixDuration);
          if (videoEl.duration === Infinity || Number.isNaN(videoEl.duration)) {
            videoEl.currentTime = 1e7;
            videoEl.addEventListener('timeupdate', () => { videoEl.currentTime = 0; }, { once: true });
          }
        });
        videoEl.src = videoUrl;
        canvas.hidden = true;
        videoEl.hidden = false;
        downloadBtn.href = videoUrl;
        downloadBtn.download = `pathshala-x-${slug(question)}.${type.includes('mp4') ? 'mp4' : 'webm'}`;
        downloadBtn.hidden = false;
        status.textContent = `Your video is ready · ${fmtDuration(totalDur)} · ${(blob.size / 1024 / 1024).toFixed(1)} MB`;
      } else {
        status.textContent = 'Finished playing.';
      }
      stopBtn.hidden = true;
      againBtn.hidden = false;
      audioCtx?.close();
      run = null;
    }

    function cancel() {
      if (!run) return;
      run.cancelled = true;
      cancelAnimationFrame(run.frame);
      run.sources.forEach((s) => { try { s.stop(); } catch (e) { /* already stopped */ } });
      if (PXSpeech.canSpeak) speechSynthesis.cancel();
      run.audioCtx?.close();
      run = null;
    }

    startBtn.addEventListener('click', start);
    againBtn.addEventListener('click', () => { reset(); start(); });
    stopBtn.addEventListener('click', () => {
      cancel();
      reset();
      status.textContent = 'Stopped. Press “Create video” to start again.';
    });
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      cancel();
      videoEl.pause();
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      dialog.remove();
    });
    dialog.showModal();
    return dialog;
  }

  window.PXVideo = { open, buildScenes };
})();
