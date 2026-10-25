// ===== 程序化音效（WebAudio 合成，无素材依赖）=====
// 乌托邦 · 视听改造
let actx = null;
let muted = localStorage.getItem('utopia_muted') === '1';

function ensureCtx() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return null; }
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

// 首次用户手势时解锁音频
document.addEventListener('pointerdown', function unlock() {
  ensureCtx();
  document.removeEventListener('pointerdown', unlock);
}, { once: true });

function tone(freq, dur, type = 'sine', vol = 0.16, delay = 0, slideTo = null) {
  if (muted) return;
  const ctx = ensureCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(dur = 0.25, vol = 0.1, delay = 0) {
  if (muted) return;
  const ctx = ensureCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t0);
}

export const Sfx = {
  click: () => tone(640, 0.05, 'triangle', 0.08),
  open: () => { tone(440, 0.07, 'sine', 0.07); tone(660, 0.07, 'sine', 0.06, 0.05); },
  war: () => { noiseBurst(0.5, 0.22); tone(96, 0.5, 'sawtooth', 0.2, 0, 60); tone(128, 0.35, 'square', 0.08, 0.08); },
  battle: () => { noiseBurst(0.3, 0.14); tone(140, 0.25, 'sawtooth', 0.1, 0, 90); },
  occupy: () => { tone(392, 0.09, 'triangle', 0.12); tone(523, 0.12, 'triangle', 0.12, 0.08); },
  peace: () => { tone(523, 0.16, 'sine', 0.1); tone(659, 0.16, 'sine', 0.1, 0.1); tone(784, 0.24, 'sine', 0.1, 0.2); },
  victory: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.13, i * 0.12)); },
  defeat: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.09, i * 0.16)); },
  notify: () => tone(880, 0.06, 'sine', 0.05),
  toggleMute() {
    muted = !muted;
    localStorage.setItem('utopia_muted', muted ? '1' : '0');
    return muted;
  },
  isMuted: () => muted,
};

// 按钮/弹窗的通用音效钩子
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.classList.contains('popup-close') || b.closest('.aoh-popup-overlay')) Sfx.open();
  else Sfx.click();
}, true);
