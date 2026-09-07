/**
 * Simple Web Audio API soundscape for the game.
 * Synthesizes crowd ambience, whistles, and a simple menu music loop.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let crowdNode: AudioBufferSourceNode | null = null;
let menuLoop: { stop: () => void } | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.35;
      masterGain.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  return ctx;
}

export function setEnabled(v: boolean): void {
  enabled = v;
  if (!v) stopAll();
  if (masterGain && ctx) masterGain.gain.value = v ? 0.35 : 0;
}

export function isEnabled(): boolean {
  return enabled;
}

export function stopAll(): void {
  if (crowdNode) {
    try { crowdNode.stop(); } catch { /* ignore */ }
    crowdNode = null;
  }
  if (menuLoop) {
    menuLoop.stop();
    menuLoop = null;
  }
}

export function getCrowdActive(): boolean {
  return crowdNode !== null;
}

export function stopCrowd(): void {
  if (crowdNode) {
    try { crowdNode.stop(); } catch { /* ignore */ }
    crowdNode = null;
  }
}

/** Start crowd ambience - continuous pink noise with filtering */
export function startCrowd(): void {
  const c = getCtx();
  if (!c || !masterGain || !enabled || crowdNode) return;
  const buf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
  const data = buf.getChannelData(0);
  // Generate pink-ish noise
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
    b6 = white * 0.115926;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 800;
  const gain = c.createGain();
  gain.gain.value = 0.15;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain!);
  src.start();
  crowdNode = src;
}

/** Short whistle - try celebration */
export function playWhistle(): void {
  const c = getCtx();
  if (!c || !masterGain || !enabled) return;
  const now = c.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = 2200;
    gain.gain.setValueAtTime(0, now + i * 0.18);
    gain.gain.linearRampToValueAtTime(0.3, now + i * 0.18 + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + i * 0.18 + 0.15);
    osc.connect(gain);
    gain.connect(masterGain!);
    osc.start(now + i * 0.18);
    osc.stop(now + i * 0.18 + 0.2);
  }
}

/** Tackle impact sound */
export function playTackle(): void {
  const c = getCtx();
  if (!c || !masterGain || !enabled) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(now);
  osc.stop(now + 0.25);
  // Add noise burst
  const buf = c.createBuffer(1, c.sampleRate * 0.1, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.02));
  const src = c.createBufferSource();
  src.buffer = buf;
  const nGain = c.createGain();
  nGain.gain.value = 0.25;
  src.connect(nGain);
  nGain.connect(masterGain!);
  src.start(now);
}

/** Crowd cheer for try */
export function playCheer(): void {
  const c = getCtx();
  if (!c || !masterGain || !enabled) return;
  const now = c.currentTime;
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 1.2)) * 0.4;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1500;
  filter.Q.value = 0.7;
  const gain = c.createGain();
  gain.gain.value = 0.5;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain!);
  src.start(now);
}

/** Penalty kick / goal success chime */
export function playGoal(): void {
  const c = getCtx();
  if (!c || !masterGain || !enabled) return;
  const now = c.currentTime;
  const notes = [523, 659, 784, 1047]; // C E G C
  notes.forEach((f, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.value = f;
    const t = now + i * 0.08;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
    gain.gain.linearRampToValueAtTime(0, t + 0.25);
    osc.connect(gain);
    gain.connect(masterGain!);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}

/**
 * Short ceremonial brass/organ cue used under the visual national-anthem lineup.
 * It is deliberately instrumental: the ceremony identifies the actual national anthem on screen.
 */
export function playAnthemCue(team: 0 | 1): void {
  const c = getCtx();
  if (!c || !masterGain || !enabled) return;
  const now = c.currentTime + 0.03;
  const melody = team === 0 ? [392, 494, 523, 659, 523, 494] : [440, 523, 659, 587, 523, 440];
  const mg = masterGain;
  melody.forEach((frequency, i) => {
    const osc = c.createOscillator();
    const harmonic = c.createOscillator();
    const gain = c.createGain();
    const t = now + i * 0.29;
    osc.type = "triangle";
    harmonic.type = "sine";
    osc.frequency.value = frequency;
    harmonic.frequency.value = frequency * 2;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.11, t + 0.035);
    gain.gain.linearRampToValueAtTime(0.065, t + 0.19);
    gain.gain.linearRampToValueAtTime(0, t + 0.28);
    osc.connect(gain);
    harmonic.connect(gain);
    gain.connect(mg);
    osc.start(t); harmonic.start(t);
    osc.stop(t + 0.3); harmonic.stop(t + 0.3);
  });
}

/**
 * Menu theme: a warm, slow stadium anthem. Soft pad chords, a gentle bass line,
 * a quiet pentatonic melody and brushed hats. Deliberately calm and musical.
 */
export function startMenuMusic(): void {
  const c = getCtx();
  if (!c || !masterGain || !enabled || menuLoop) return;
  const mg = masterGain!;
  const bpm = 84;
  const beat = 60 / bpm;
  const bar = beat * 4;
  // A minor progression with a lift: Am - F - C - G, twice with a G ending.
  const bars = [
    { bass: 110, pad: [220, 261.6, 329.6] },   // Am
    { bass: 87.3, pad: [174.6, 220, 261.6] },   // F
    { bass: 130.8, pad: [196, 261.6, 329.6] },  // C
    { bass: 98, pad: [196, 246.9, 293.7] },     // G
    { bass: 110, pad: [220, 261.6, 329.6] },
    { bass: 87.3, pad: [174.6, 220, 261.6] },
    { bass: 130.8, pad: [196, 261.6, 329.6] },
    { bass: 98, pad: [246.9, 293.7, 392] },     // G lift
  ];
  // Pentatonic melody (A minor pentatonic), one note per beat, rests included.
  const melody = [
    440, 0, 523.3, 587.3, 659.3, 0, 587.3, 523.3,
    440, 523.3, 0, 659.3, 784, 0, 659.3, 523.3,
    440, 0, 523.3, 587.3, 659.3, 784, 880, 0,
    784, 659.3, 587.3, 523.3, 440, 0, 0, 0,
  ];
  let stopped = false;
  let loopId: number | null = null;
  const live: OscillatorNode[] = [];

  const scheduleLoop = (startAt: number) => {
    bars.forEach((barDef, bi) => {
      const t0 = startAt + bi * bar;
      // Pad
      barDef.pad.forEach((f) => {
        const o = c.createOscillator(); const g = c.createGain();
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.035, t0 + 0.4);
        g.gain.setValueAtTime(0.035, t0 + bar - 0.5);
        g.gain.linearRampToValueAtTime(0, t0 + bar);
        o.connect(g); g.connect(mg); o.start(t0); o.stop(t0 + bar);
        live.push(o);
      });
      // Bass
      const bo = c.createOscillator(); const bg = c.createGain();
      bo.type = "triangle"; bo.frequency.value = barDef.bass;
      bg.gain.setValueAtTime(0, t0);
      bg.gain.linearRampToValueAtTime(0.06, t0 + 0.05);
      bg.gain.linearRampToValueAtTime(0.045, t0 + bar - 0.1);
      bg.gain.linearRampToValueAtTime(0, t0 + bar);
      bo.connect(bg); bg.connect(mg); bo.start(t0); bo.stop(t0 + bar);
      live.push(bo);
      // Hats (soft noise ticks)
      for (let b2 = 0; b2 < 4; b2++) {
        const ht = t0 + b2 * beat + beat / 2;
        const hb = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate);
        const hd = hb.getChannelData(0);
        for (let i = 0; i < hd.length; i++) hd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.012));
        const hs = c.createBufferSource(); hs.buffer = hb;
        const hg = c.createGain(); hg.gain.value = 0.02;
        const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
        hs.connect(hp); hp.connect(hg); hg.connect(mg); hs.start(ht);
      }
    });
    // Melody
    melody.forEach((f, i) => {
      if (!f) return;
      const t = startAt + i * beat;
      const o = c.createOscillator(); const g = c.createGain();
      o.type = "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.9);
      o.connect(g); g.connect(mg); o.start(t); o.stop(t + beat);
      live.push(o);
    });
  };

  const startAt = c.currentTime + 0.1;
  scheduleLoop(startAt);
  const loopDur = bars.length * bar;
  loopId = window.setInterval(() => { if (!stopped) scheduleLoop(c.currentTime + 0.12); }, loopDur * 1000);
  menuLoop = {
    stop: () => {
      stopped = true;
      if (loopId !== null) window.clearInterval(loopId);
      live.forEach((o) => { try { o.stop(); } catch { /* ignore */ } });
      live.length = 0;
    },
  };
}

/** Stop menu music */
export function stopMenuMusic(): void {
  if (menuLoop) {
    menuLoop.stop();
    menuLoop = null;
  }
}

// ---------------------------------------------------------------------------
// Additional sound effects
// ---------------------------------------------------------------------------

function noiseBuffer(c: AudioContext, seconds: number, decay: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * seconds)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * decay));
  return buf;
}

/** Short UI selection blip. */
export function playBlip(): void {
  const c = getCtx(); if (!c || !masterGain || !enabled) return;
  const t = c.currentTime;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = "square"; o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(880, t + 0.04);
  g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.connect(g); g.connect(masterGain!); o.start(t); o.stop(t + 0.1);
}

/** Pass whoosh. */
export function playPass(): void {
  const c = getCtx(); if (!c || !masterGain || !enabled) return;
  const t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 0.12, 0.05);
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(2600, t + 0.1); bp.Q.value = 1.2;
  const g = c.createGain(); g.gain.setValueAtTime(0.14, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(bp); bp.connect(g); g.connect(masterGain!); src.start(t);
}

/** Kick thump + whoosh. */
export function playKick(): void {
  const c = getCtx(); if (!c || !masterGain || !enabled) return;
  const t = c.currentTime;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.18);
  g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g); g.connect(masterGain!); o.start(t); o.stop(t + 0.22);
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 0.16, 0.06);
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.14);
  const g2 = c.createGain(); g2.gain.setValueAtTime(0.12, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  src.connect(bp); bp.connect(g2); g2.connect(masterGain!); src.start(t);
}

/** Crowd swell for line breaks / near misses. */
export function playCrowdSwell(): void {
  const c = getCtx(); if (!c || !masterGain || !enabled) return;
  const t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 0.9, 0.4);
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1200; bp.Q.value = 0.6;
  const g = c.createGain(); g.gain.setValueAtTime(0.02, t); g.gain.linearRampToValueAtTime(0.16, t + 0.25); g.gain.linearRampToValueAtTime(0, t + 0.9);
  src.connect(bp); bp.connect(g); g.connect(masterGain!); src.start(t);
}

/** Pack opening whoosh + shimmer. */
export function playPackOpen(): void {
  const c = getCtx(); if (!c || !masterGain || !enabled) return;
  const t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 0.4, 0.15);
  const bp = c.createBiquadFilter(); bp.type = "highpass"; bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(5000, t + 0.35);
  const g = c.createGain(); g.gain.setValueAtTime(0.1, t); g.gain.linearRampToValueAtTime(0.2, t + 0.2); g.gain.linearRampToValueAtTime(0, t + 0.4);
  src.connect(bp); bp.connect(g); g.connect(masterGain!); src.start(t);
  [880, 1108.7, 1318.5].forEach((f, i) => {
    const o = c.createOscillator(); const g2 = c.createGain();
    o.type = "sine"; o.frequency.value = f;
    const st = t + 0.25 + i * 0.07;
    g2.gain.setValueAtTime(0, st); g2.gain.linearRampToValueAtTime(0.06, st + 0.02); g2.gain.exponentialRampToValueAtTime(0.001, st + 0.3);
    o.connect(g2); g2.connect(masterGain!); o.start(st); o.stop(st + 0.32);
  });
}

/** Coin / funds jingle for selling & rewards. */
export function playCoin(): void {
  const c = getCtx(); if (!c || !masterGain || !enabled) return;
  const t = c.currentTime;
  [1318.5, 1760].forEach((f, i) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "square"; o.frequency.value = f;
    const st = t + i * 0.08;
    g.gain.setValueAtTime(0.05, st); g.gain.exponentialRampToValueAtTime(0.001, st + 0.18);
    o.connect(g); g.connect(masterGain!); o.start(st); o.stop(st + 0.2);
  });
}

/** Promotion / victory fanfare. */
export function playFanfare(): void {
  const c = getCtx(); if (!c || !masterGain || !enabled) return;
  const t = c.currentTime;
  const notes = [392, 523.3, 659.3, 784, 1046.5];
  notes.forEach((f, i) => {
    const st = t + i * 0.11;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "triangle"; o.frequency.value = f;
    g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.12, st + 0.03); g.gain.linearRampToValueAtTime(0, st + (i === notes.length - 1 ? 0.6 : 0.2));
    o.connect(g); g.connect(masterGain!); o.start(st); o.stop(st + 0.7);
  });
}

/** Short double-whistle for penalties / stoppages. */
export function playWhistleShort(): void {
  const c = getCtx(); if (!c || !masterGain || !enabled) return;
  const t = c.currentTime;
  for (let i = 0; i < 2; i++) {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "sine"; o.frequency.value = 2400;
    const st = t + i * 0.14;
    g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.22, st + 0.02); g.gain.linearRampToValueAtTime(0, st + 0.11);
    o.connect(g); g.connect(masterGain!); o.start(st); o.stop(st + 0.13);
  }
}
