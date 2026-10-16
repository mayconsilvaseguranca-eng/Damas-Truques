// Efeitos sonoros e música gerados na hora (Web Audio) — sem arquivos de áudio.
'use strict';
const Sfx = (() => {
  let ac = null, master, music, sfx, noiseBuf;
  let mode = 0; // 0 = tudo ligado, 1 = só efeitos, 2 = mudo
  try { mode = +localStorage.getItem('nsf-audio') || 0; } catch (e) {}
  const last = {};

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.connect(ac.destination);
    master = ac.createGain(); master.gain.value = 0.8; master.connect(comp);
    music = ac.createGain(); music.connect(master);
    sfx = ac.createGain(); sfx.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    apply();
  }
  function apply() {
    if (!ac) return;
    music.gain.value = mode === 0 ? 0.32 : 0;
    sfx.gain.value = mode === 2 ? 0 : 0.6;
  }
  function cycle() {
    mode = (mode + 1) % 3;
    try { localStorage.setItem('nsf-audio', mode); } catch (e) {}
    init(); apply();
    return mode;
  }
  // limita sons repetidos (evita barulheira com 300 inimigos)
  function gate(name, ms) {
    const now = performance.now();
    if (last[name] && now - last[name] < ms) return false;
    last[name] = now; return true;
  }

  function tone(f, dur, type, vol, f2, when, dest) {
    if (!ac) return;
    const t = (when || ac.currentTime);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfx);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq, when, dest, type) {
    if (!ac) return;
    const t = (when || ac.currentTime);
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 1000;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  const play = {
    shoot() { if (gate('shoot', 90)) tone(880, 0.08, 'square', 0.05, 1500); },
    hit()   { if (gate('hit', 60)) noise(0.06, 0.12, 1800); },
    kill()  { if (gate('kill', 70)) { tone(300 + Math.random() * 80, 0.09, 'square', 0.06, 90); noise(0.08, 0.08, 600); } },
    gem(p)  { if (gate('gem', 45)) tone(900 + Math.min(p, 12) * 60, 0.07, 'triangle', 0.09); },
    hurt()  { if (gate('hurt', 280)) { tone(160, 0.18, 'sawtooth', 0.12, 60); noise(0.12, 0.15, 400, 0, 0, 'lowpass'); } },
    nova()  { if (gate('nova', 200)) { noise(0.5, 0.18, 300, 0, 0, 'lowpass'); tone(220, 0.4, 'sine', 0.12, 50); } },
    level() {
      if (!ac) return; const t = ac.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.08, 0, t + i * 0.07));
    },
    pick()  { tone(660, 0.06, 'triangle', 0.1); tone(990, 0.1, 'triangle', 0.08, 0, ac && ac.currentTime + 0.05); },
    click() { tone(500, 0.05, 'triangle', 0.08); },
    down()  { if (!ac) return; const t = ac.currentTime; [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.08, 0, t + i * 0.12)); },
    revive(){ if (!ac) return; const t = ac.currentTime; [262, 392, 523, 784].forEach((f, i) => tone(f, 0.2, 'triangle', 0.1, 0, t + i * 0.08)); },
    boss()  { if (!ac) return; const t = ac.currentTime; tone(82, 1.2, 'sawtooth', 0.2, 0, t); tone(87, 1.2, 'sawtooth', 0.15, 0, t); tone(110, 1.0, 'square', 0.1, 0, t + 0.6); },
    join()  { if (!ac) return; const t = ac.currentTime; tone(523, 0.1, 'square', 0.07, 0, t); tone(784, 0.15, 'square', 0.07, 0, t + 0.09); },
    win()   { if (!ac) return; const t = ac.currentTime; [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.3, 'square', 0.09, 0, t + i * 0.14)); },
    lose()  { if (!ac) return; const t = ac.currentTime; [440, 415, 392, 370, 330].forEach((f, i) => tone(f, 0.4, 'triangle', 0.12, 0, t + i * 0.22)); }
  };

  // ---------- música de fundo ----------
  // Lá menor sombrio, 4 acordes: Am - F - G - Em
  const CHORDS = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]];
  const LEAD = [ // notas MIDI por passo de 1/8 (0 = pausa), 4 compassos
    [69, 0, 72, 0, 71, 69, 67, 0], [65, 0, 69, 0, 67, 65, 64, 0],
    [67, 0, 71, 0, 74, 72, 71, 0], [64, 67, 71, 0, 69, 0, 0, 0]
  ];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  let playing = false, step = 0, nextT = 0, timer = null, intensity = 0;

  function schedStep(s, t) {
    const bar = Math.floor(s / 16) % 4, st = s % 16, ch = CHORDS[bar];
    const sixteenth = 60 / (112 + intensity * 16) / 4;
    // bumbo e caixa
    if (st % 8 === 0 || (intensity && st === 14)) tone(120, 0.18, 'sine', 0.5, 40, t, music);
    if (st === 4 || st === 12) noise(0.12, 0.25, 1800, t, music);
    if (st % 2 === 0 || intensity) noise(0.03, st % 4 === 2 ? 0.1 : 0.05, 8000, t, music, 'highpass');
    // baixo
    if (st % 2 === 0) tone(mtof(ch[0] - 24), sixteenth * 1.8, 'square', 0.13, 0, t, music);
    // arpejo
    tone(mtof(ch[st % 3] + 12), sixteenth * 0.9, 'triangle', 0.05, 0, t, music);
    // melodia (só quando a coisa esquenta)
    if (intensity && st % 2 === 0) {
      const n = LEAD[bar][st / 2];
      if (n) tone(mtof(n), sixteenth * 1.9, 'square', 0.05, 0, t, music);
    }
    return sixteenth;
  }
  function tick() {
    if (!ac || !playing) return;
    while (nextT < ac.currentTime + 0.15) {
      nextT += schedStep(step, nextT);
      step++;
    }
  }
  function startMusic() {
    init(); if (!ac || playing) return;
    playing = true; step = 0; nextT = ac.currentTime + 0.1;
    clearInterval(timer); timer = setInterval(tick, 30);
  }
  function stopMusic() { playing = false; clearInterval(timer); }
  function setIntensity(v) { intensity = v ? 1 : 0; }

  return { init, cycle, get mode() { return mode; }, play, startMusic, stopMusic, setIntensity };
})();
