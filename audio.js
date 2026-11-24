// Synthesised sounds in Middling's style: soft bells, plucks and puffs
// through a small reverb. No audio files.
window.Sound = (function () {
  const N = n => 440 * Math.pow(2, (n - 69) / 12);
  const C4 = 60, E4 = 64, G4 = 67, C5 = 72, D5 = 74, E5 = 76, G5 = 79, A5 = 81, C6 = 84, D6 = 86, E6 = 88;
  let ctx = null, out = null;
  const api = { muted: false };
  try { api.muted = localStorage.getItem('isle-muted') === '1'; } catch (e) {}

  function setup() {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return false;
    ctx = new C();
    out = ctx.createGain(); out.gain.value = 0.9;
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    const verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    verb.buffer = ir;
    const comp = ctx.createDynamicsCompressor();
    out.connect(comp);
    out.connect(verb).connect(wet).connect(comp);
    comp.connect(ctx.destination);
    return true;
  }

  function bell(freq, at = 0, dur = 0.9, gain = 0.12) {
    const t0 = ctx.currentTime + at;
    for (const [mul, g] of [[1, 1], [2.01, 0.35], [3.98, 0.12]]) {
      const o = ctx.createOscillator(), v = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq * mul;
      v.gain.setValueAtTime(0, t0);
      v.gain.linearRampToValueAtTime(gain * g, t0 + 0.006);
      v.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / mul);
      o.connect(v).connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
    }
  }

  function pluck(freq, { at = 0, to = freq, dur = 0.16, gain = 0.1, type = 'triangle', cutoff = 2400 } = {}) {
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator(), v = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (to !== freq) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    f.type = 'lowpass'; f.frequency.value = cutoff;
    v.gain.setValueAtTime(0, t0);
    v.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    v.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.08);
    o.connect(f).connect(v).connect(out); o.start(t0); o.stop(t0 + dur + 0.12);
  }

  function puff({ at = 0, dur = 0.08, gain = 0.08, from = 2000, to = from, q = 1 } = {}) {
    const t0 = ctx.currentTime + at;
    const len = Math.ceil(ctx.sampleRate * (dur + 0.05)), buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), v = ctx.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    v.gain.setValueAtTime(0, t0); v.gain.linearRampToValueAtTime(gain, t0 + dur * 0.3);
    v.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(v).connect(out); s.start(t0); s.stop(t0 + dur + 0.05);
  }

  const SOUNDS = {
    tap: () => puff({ dur: 0.05, gain: 0.06, from: 3200, q: 2 }),
    tick: () => pluck(N(C6), { dur: 0.07, gain: 0.05, type: 'sine', cutoff: 3000 }),
    key: () => puff({ dur: 0.03, gain: 0.025, from: 4200 + Math.random() * 800, q: 3 }),
    correct: () => [E5, G5, C6].forEach((n, i) => bell(N(n), i * 0.09, 1, 0.1)),
    streak: () => {
      [C5, E5, G5, C6, E6].forEach((n, i) => bell(N(n), i * 0.075, 1.2, 0.1));
      [D6, A5, E6].forEach((n, i) => bell(N(n + 12), 0.42 + i * 0.09, 0.5, 0.03));
    },
    near: () => { pluck(N(G5), { dur: 0.1, gain: 0.07 }); pluck(N(A5), { at: 0.1, dur: 0.12, gain: 0.06 }); },
    wrong: () => { pluck(N(E4), { to: N(C4), dur: 0.22, gain: 0.12, cutoff: 900 }); puff({ at: 0.05, dur: 0.25, gain: 0.03, from: 500, to: 300 }); },
    skip: () => { pluck(N(G4), { to: N(E4), dur: 0.14, gain: 0.08 }); puff({ dur: 0.18, gain: 0.04, from: 1500, to: 600 }); },
    whoosh: () => puff({ dur: 2.4, gain: 0.05, from: 300, to: 1400, q: 0.8 }),
    flip: () => { puff({ dur: 0.12, gain: 0.06, from: 1800, to: 900, q: 1.5 }); pluck(N(C5), { at: 0.08, dur: 0.1, gain: 0.05 }); },
    win: () => {
      [C5, E5, G5, C6].forEach((n, i) => bell(N(n), i * 0.11, 1.2, 0.1));
      [G5, C6, E6].forEach(n => bell(N(n), 0.5, 1.8, 0.06));
      [D5, E5, G5].forEach((n, i) => pluck(N(n + 12), { at: 0.9 + i * 0.07, dur: 0.1, gain: 0.03 }));
    }
  };

  api.play = function (name) {
    if (api.muted || !SOUNDS[name]) return;
    if (!ctx && !setup()) return;
    if (ctx.state === 'suspended') ctx.resume();
    try { SOUNDS[name](); } catch (e) {}
  };
  api.toggle = function () {
    api.muted = !api.muted;
    try { localStorage.setItem('isle-muted', api.muted ? '1' : '0'); } catch (e) {}
    return api.muted;
  };
  return api;
})();
