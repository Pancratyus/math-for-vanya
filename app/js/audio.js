/* audio.js — короткие звуки через WebAudio (без файлов). */

let ctx = null;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function beep(freq, dur, delay = 0, type = 'sine', gain = 0.12) {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

export function soundCorrect() { beep(660, 0.12); beep(990, 0.18, 0.1); }
export function soundWrong()   { beep(220, 0.25, 0, 'triangle', 0.14); }
export function soundFinish()  { beep(523, 0.15); beep(659, 0.15, 0.13); beep(784, 0.3, 0.26); }
