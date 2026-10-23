// Generative motifs, 90-second score and look-ahead scheduler.
const scale = [0, 3, 5, 7, 10, 12, 15, 17];
let melody;
function renewMelody(keepTonic = false) {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  melody = new FortuneMelody(
    seed,
    keepTonic && melody ? melody.transpose : undefined,
  );
}
renewMelody();
// Continuous score: interpolate every parameter across overlapping musical sections.
const score = [
  [0, 60, 0.04, 0.18, 0.7, 0.65, 0.8, 0.9, 0.48, 0, 0.32, 0.18, 0, 0, 0.46],
  [12, 66, 0.08, 0.25, 0.55, 0.5, 0.75, 0.85, 0.58, 0.02, 0.7, 0.5, 0, 0, 0.5],
  [
    28, 72, 0.15, 0.37, 0.4, 0.45, 0.65, 0.72, 0.62, 0.18, 0.8, 0.62, 0.08, 0,
    0.55,
  ],
  [
    42, 80, 0.28, 0.52, 0.22, 0.35, 0.6, 0.62, 0.6, 0.38, 0.7, 0.6, 0.4, 0.12,
    0.55,
  ],
  [
    60, 94, 0.48, 0.68, 0.12, 0.28, 0.5, 0.5, 0.58, 0.5, 0.62, 0.68, 0.65, 0.3,
    0.58,
  ],
  [
    78, 108, 1, 0.86, 0.05, 0.18, 0.35, 0.32, 0.55, 0.6, 0.5, 0.72, 0.82, 0.65,
    0.6,
  ],
  [
    88, 100, 0.65, 0.73, 0.14, 0.3, 0.52, 0.48, 0.57, 0.5, 0.67, 0.7, 0.55, 0.4,
    0.57,
  ],
  [
    102, 82, 0.25, 0.45, 0.4, 0.55, 0.72, 0.8, 0.48, 0.35, 0.85, 0.75, 0.18,
    0.1, 0.53,
  ],
  [112, 68, 0.08, 0.25, 0.65, 0.7, 0.8, 1, 0.2, 0.12, 0.9, 0.7, 0, 0, 0.47],
  [120, 60, 0, 0.18, 0.7, 0.8, 0.8, 1, 0, 0, 0.9, 0.7, 0, 0, 0.38],
];
const keys = [
  "bpm",
  "fate",
  "cutoff",
  "attack",
  "decay",
  "sustain",
  "release",
  "vol0",
  "vol1",
  "fx.reverb",
  "fx.delay",
  "fx.chorus",
  "fx.drive",
  "master",
];
function automate(t) {
  t *= 120 / DURATION;
  let b = score.findIndex((p) => p[0] > t);
  if (b < 0) b = score.length - 1;
  let a = Math.max(0, b - 1),
    v = clamp((t - score[a][0]) / (score[b][0] - score[a][0] || 1));
  v = v * v * (3 - 2 * v);
  keys.forEach((k, j) => {
    if ((touches.get(k) || 0) > performance.now()) return;
    let n = score[a][j + 1] + (score[b][j + 1] - score[a][j + 1]) * v;
    if (k.startsWith("fx.")) S.fx[k.slice(3)] = n;
    else if (k.startsWith("vol")) S.vol[+k.slice(3)] = n;
    else S[k] = n;
  });
  if ((touches.get("voice0") || 0) < performance.now()) S.voices[0] = true;
  if ((touches.get("voice1") || 0) < performance.now()) S.voices[1] = t > 20;
  if ((touches.get("steps") || 0) < performance.now()) {
    S.steps = [true, true, true, true];
    if (t > 48 && t < 80) S.steps[Math.floor((t - 48) / 4) % 4] = false;
  }
}
async function start(auto = false) {
  const ended = S.time >= DURATION;
  if (auto || !S.playing) renewMelody();
  if (auto) {
    touches.clear();
    automate(0);
    S.voices = [true, false];
  } else if (ended && S.vol.every((value) => value === 0)) {
    // An effect click after the final fade must also restart an audible voice.
    S.vol = [0.48, 0.4];
  }
  if (auto || ended) {
    S.time = 0;
    beat = 0;
  }
  muted = false;
  await audio();
  finishing = false;
  S.playing = true;
  S.auto = auto;
  epoch = ctx.currentTime - S.time;
  next = ctx.currentTime + 0.08;
  sync();
}
function finish() {
  if (finishing) return;
  finishing = true;
  muted = true;
  S.playing = false;
  S.auto = false;
  S.loop = false;
  if (ctx) {
    out.gain.cancelScheduledValues(ctx.currentTime);
    out.gain.setTargetAtTime(0, ctx.currentTime, 0.65);
  }
  sync();
  setTimeout(() => {
    finishing = false;
  }, 2500);
}
setInterval(() => {
  if (!ctx || !S.playing) return;
  S.time = ctx.currentTime - epoch;
  if (S.auto) automate(S.time);
  if (S.auto && S.time >= DURATION) {
    if (S.loop) {
      renewMelody(true);
      epoch += DURATION;
      S.time = ctx.currentTime - epoch;
      beat = 0;
      touches.clear();
      automate(S.time);
    } else {
      S.time = DURATION;
      muted = true;
      S.playing = false;
      S.auto = false;
      sync();
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      return;
    }
  }
  while (next < ctx.currentTime + 0.14) {
    const s = beat % 4;
    let level = S.auto && !S.loop ? clamp((DURATION - 4 - S.time) / 9) : 1;
    if (S.steps[s] && level > 0) {
      for (let i = 0; i < 2; i++)
        if (S.voices[i]) {
          const event = melody.next(
            i,
            beat,
            S.fate,
            S.auto ? S.time / DURATION : 0,
          );
          note(i, next, event.pitch, false, level * event.level);
        }
    }
    next += 60 / S.bpm / 2;
    beat++;
  }
  sync();
  applyAudio();
}, 50);
