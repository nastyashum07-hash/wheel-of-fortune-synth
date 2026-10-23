// Web Audio graph, synthesis and smooth parameter updates.
function curve(a) {
  let c = new Float32Array(1024),
    k = a * 20;
  for (let n = 0; n < c.length; n++) {
    let x = (n * 2) / 1023 - 1;
    c[n] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return c;
}
// Context injection also allows real OfflineAudioContext regression tests.
function buildAudioGraph(context) {
  ctx = context;
  buses = [];
  out = ctx.createGain();
  out.gain.value = 0;
  filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.6;
  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -13;
  compressor.ratio.value = 6;
  filter.connect(compressor).connect(out).connect(ctx.destination);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  data = new Float32Array(256);
  out.connect(analyser);
  for (let i = 0; i < 2; i++) {
    let input = ctx.createGain(),
      lp = ctx.createBiquadFilter(),
      sh = ctx.createWaveShaper(),
      pan = ctx.createStereoPanner(),
      delay = ctx.createDelay(2),
      fb = ctx.createGain(),
      wet = ctx.createGain(),
      rev = ctx.createGain(),
      conv = ctx.createConvolver(),
      ch = ctx.createDelay(0.1),
      cw = ctx.createGain(),
      lfo = ctx.createOscillator(),
      depth = ctx.createGain();
    input.connect(lp).connect(sh).connect(pan);
    sh.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(pan);
    sh.connect(conv).connect(rev).connect(pan);
    sh.connect(ch).connect(cw).connect(pan);
    pan.pan.value = i ? 0.82 : -0.82;
    pan.connect(filter);
    sh.oversample = "2x";
    lp.type = "lowpass";
    lp.frequency.value = i ? 7000 : 1700;
    delay.delayTime.value = 0.44;
    fb.gain.value = 0.36;
    ch.delayTime.value = 0.02;
    lfo.frequency.value = 0.27 + i * 0.13;
    depth.gain.value = 0.003;
    lfo.connect(depth).connect(ch.delayTime);
    lfo.start();
    const ir = ctx.createBuffer(2, ctx.sampleRate * 4, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const a = ir.getChannelData(c);
      for (let n = 0; n < a.length; n++)
        a[n] = (Math.random() * 2 - 1) * Math.pow(1 - n / a.length, 3);
    }
    conv.buffer = ir;
    buses.push({ input, lp, sh, pan, delay, fb, wet, rev, cw, drive: -1 });
  }
}
async function audio() {
  if (!ctx) buildAudioGraph(new AudioContext());
  await ctx.resume();
  applyAudio();
}
function applyAudio() {
  if (!ctx) return;
  const t = ctx.currentTime;
  filter.frequency.setTargetAtTime(170 * Math.pow(65, S.cutoff), t, 0.5);
  out.gain.setTargetAtTime(muted ? 0 : S.master * 0.65, t, 0.3);
  buses.forEach((b, i) => {
    b.input.gain.setTargetAtTime(S.voices[i] ? S.vol[i] : 0, t, 0.7);
    b.lp.frequency.setTargetAtTime(i ? 7500 : 450 + S.cutoff * 2200, t, 0.4);
    let k = Math.round(S.fx.drive * 30) / 30;
    if (k !== b.drive) {
      b.sh.curve = curve(k * 0.65);
      b.drive = k;
    }
    b.wet.gain.setTargetAtTime(S.fx.delay * 0.5, t, 0.7);
    b.rev.gain.setTargetAtTime(S.fx.reverb * 0.42, t, 0.7);
    b.cw.gain.setTargetAtTime(S.fx.chorus * 0.4, t, 0.7);
  });
}
function note(i, t, n, slide = false, level = 1) {
  let osc = ctx.createOscillator(),
    sub = ctx.createOscillator(),
    env = ctx.createGain(),
    g = ctx.createGain(),
    freq =
      (i ? 293.665 : 73.416) * 2 ** ((scale[n % 8] + melody.transpose) / 12);
  osc.type = i ? "sine" : "triangle";
  sub.type = i ? "triangle" : "sine";
  g.gain.value = i ? 0.12 : 0.5;
  osc.frequency.setValueAtTime(slide ? freq * (i ? 0.5 : 1.5) : freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.5);
  sub.frequency.value = freq * (i ? 2.003 : 0.5);
  osc.connect(env);
  sub.connect(g).connect(env);
  env.connect(buses[i].input);
  let a = 0.035 + S.attack * 0.9,
    d = 0.12 + S.decay * 0.7,
    r = 0.7 + S.release * 3,
    peak = (i ? 0.19 : 0.3) * level;
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + a);
  env.gain.linearRampToValueAtTime(peak * (0.2 + S.sustain * 0.65), t + a + d);
  env.gain.exponentialRampToValueAtTime(0.00001, t + a + d + r);
  osc.start(t);
  sub.start(t);
  osc.stop(t + a + d + r + 0.1);
  sub.stop(t + a + d + r + 0.1);
  osc.onended = () => {
    osc.disconnect();
    sub.disconnect();
    env.disconnect();
    g.disconnect();
  };
  setTimeout(
    () => {
      let f = figures[i ? "anubis" : "snake"];
      f.classList.add("pulse");
      setTimeout(() => f.classList.remove("pulse"), 200);
    },
    Math.max(0, (t - ctx.currentTime) * 1000),
  );
}
async function manual(i) {
  muted = false;
  await audio();
  let was = S.voices[i];
  S.voices[i] = true;
  applyAudio();
  note(i, ctx.currentTime, i ? 4 : 0, true);
  if (!was) sync();
}
