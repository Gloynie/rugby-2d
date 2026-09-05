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

/** Simple menu music loop - 4-bar progression */
export function startMenuMusic(): void {
  const c = getCtx();
  if (!c || !masterGain || !enabled || menuLoop) return;

  // Simple chord progression: C - G - Am - F - C - G - Am - G
  const chords = [
    [261, 329, 392], // C
    [196, 246, 293], // G
    [220, 261, 329], // Am
    [174, 220, 261], // F
    [261, 329, 392], // C
    [196, 246, 293], // G
    [220, 261, 329], // Am
    [196, 246, 293], // G
  ];
  const chordDur = 1.5;
  const loopDur = chords.length * chordDur;

  let stopped = false;
  let loopId: number | null = null;
  const activeOscs: OscillatorNode[] = [];

  const mg = masterGain!;
  const scheduleLoop = (startAt: number) => {
    chords.forEach((notes, i) => {
      const t = startAt + i * chordDur;
      notes.forEach((f) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = "triangle";
        osc.frequency.value = f / 2; // Lower octave for warmth
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.08, t + 0.1);
        gain.gain.setValueAtTime(0.08, t + chordDur - 0.15);
        gain.gain.linearRampToValueAtTime(0, t + chordDur);
        osc.connect(gain);
        gain.connect(mg);
        osc.start(t);
        osc.stop(t + chordDur);
        activeOscs.push(osc);
      });
    });
  };

  const now = c.currentTime + 0.1;
  scheduleLoop(now);
  loopId = window.setInterval(() => {
    if (stopped) return;
    scheduleLoop(c.currentTime + 0.1);
  }, loopDur * 1000);

  menuLoop = {
    stop: () => {
      stopped = true;
      if (loopId !== null) window.clearInterval(loopId);
      activeOscs.forEach((o) => { try { o.stop(); } catch { /* ignore */ } });
      activeOscs.length = 0;
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
