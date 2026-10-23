const fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto").webcrypto;
const melodyCode = fs.readFileSync("dist/melody.js", "utf8");
const mc = vm.createContext({});
vm.runInContext(melodyCode + ";globalThis.M=FortuneMelody", mc);
const M = mc.M;
function sequence(seed, fate) {
  const m = new M(seed);
  return Array.from({ length: 128 }, (_, b) => m.next(b % 2, b, fate, 0).pitch);
}
assert.deepEqual(sequence(7, 0.6), sequence(7, 0.6));
assert.notDeepEqual(sequence(7, 0), sequence(8, 0));
assert.notDeepEqual(sequence(7, 0), sequence(7, 1));
for (let seed = 1; seed <= 100; seed++)
  for (const fate of [0, 0.25, 0.5, 1]) {
    const m = new M(seed);
    for (let b = 0; b < 256; b++) {
      const e = m.next(b % 2, b, fate, b / 256);
      assert(Number.isInteger(e.pitch) && e.pitch >= 0 && e.pitch < 8);
      assert(e.level >= 0.82 && e.level <= 1);
    }
  }
const unique = new Set(
  Array.from({ length: 100 }, (_, i) => sequence(i, 0.5).join(",")),
);
assert.equal(unique.size, 100);
const elements = new Map();
function element() {
  return {
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    dataset: {},
    setAttribute() {},
    getAttribute() {
      return null;
    },
    append() {},
    matches() {
      return false;
    },
    remove() {},
    innerHTML: "",
    offsetWidth: 10,
  };
}
const document = {
  querySelector(s) {
    if (!elements.has(s)) elements.set(s, element());
    return elements.get(s);
  },
  querySelectorAll() {
    return [];
  },
  createElement: element,
  addEventListener() {},
  body: element(),
};
let interval;
const graph = [];
function param() {
  return {
    value: 0,
    setTargetAtTime() {},
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {},
  };
}
function node(type) {
  const n = {
    type,
    edges: [],
    connect(to) {
      this.edges.push(to);
      return to;
    },
    disconnect() {},
    start() {},
    stop() {},
  };
  for (const key of [
    "gain",
    "frequency",
    "Q",
    "pan",
    "threshold",
    "ratio",
    "delayTime",
  ])
    n[key] = param();
  graph.push(n);
  return n;
}
class AudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 64;
    this.destination = node("destination");
  }
  resume() {
    return Promise.resolve();
  }
  createGain() {
    return node("gain");
  }
  createBiquadFilter() {
    return node("filter");
  }
  createDynamicsCompressor() {
    return node("compressor");
  }
  createAnalyser() {
    const n = node("analyser");
    n.getFloatTimeDomainData = () => {};
    return n;
  }
  createStereoPanner() {
    return node("pan");
  }
  createDelay() {
    return node("delay");
  }
  createWaveShaper() {
    return node("waveshaper");
  }
  createConvolver() {
    return node("convolver");
  }
  createOscillator() {
    return node("oscillator");
  }
  createBuffer(ch, n) {
    return {
      getChannelData() {
        return new Float32Array(n);
      },
    };
  }
}
const c = vm.createContext({
  document,
  AudioContext,
  crypto,
  performance: { now: () => 0 },
  Image: class {
    decode() {
      return Promise.resolve();
    }
  },
  setTimeout() {},
  clearTimeout() {},
  setInterval(f) {
    interval = f;
  },
  requestAnimationFrame() {},
  console,
});
for (const name of [
  "state",
  "melody",
  "audio",
  "sequencer",
  "interface",
  "animation",
  "app",
])
  vm.runInContext(fs.readFileSync(`dist/${name}.js`, "utf8"), c);
(async () => {
  await vm.runInContext("start(true)", c);
  for (const id of [
    "master",
    "fate",
    "vol0",
    "vol1",
    "attack",
    "decay",
    "sustain",
    "release",
  ]) {
    c.controlId = id;
    assert.equal(vm.runInContext("nextControlValue(controlId, 1)", c), 0.9);
    assert.equal(vm.runInContext("nextControlValue(controlId, 0)", c), 0.1);
  }
  const pan = graph.filter((n) => n.type === "pan");
  assert.equal(pan.length, 2);
  assert.equal(pan[0].pan.value, -0.82);
  assert.equal(pan[1].pan.value, 0.82);
  // Current buses intentionally expose only the processing handles used by controls.
  const chain = vm.runInContext(
    'buses.every(b=>b.input.edges.includes(b.lp)&&b.lp.edges.includes(b.sh)&&b.sh.edges.some(n=>n.type==="pan")&&b.sh.edges.includes(b.delay)&&b.sh.edges.some(n=>n.type==="convolver")&&b.wet.edges.some(n=>n.type==="pan")&&b.rev.edges.some(n=>n.type==="pan")&&b.cw.edges.some(n=>n.type==="pan"))',
    c,
  );
  assert(chain);
  for (let t = 0; t <= 90; t += 0.25) {
    vm.runInContext("ctx.currentTime=" + t, c);
    interval();
    assert(
      vm.runInContext(
        "Number.isFinite(S.fate)&&S.fate>=0&&S.fate<=1&&S.vol.every(Number.isFinite)",
        c,
      ),
    );
  }
  assert(vm.runInContext("!S.playing&&S.time===90&&muted", c));
  await vm.runInContext("figures.anubis.onclick()", c);
  assert(
    vm.runInContext("S.playing && S.voices[1] && S.vol[1] > 0", c),
    "Manual voice must restart after score ends",
  );
  await vm.runInContext("S.loop=true;start(true)", c);
  const seedBefore = vm.runInContext("melody.seed", c);
  vm.runInContext("ctx.currentTime=epoch+90.01", c);
  interval();
  assert(vm.runInContext("S.playing&&!muted&&S.time<1", c));
  assert.notEqual(vm.runInContext("melody.seed", c), seedBefore);
  console.log(
    "PASS: 100 distinct sampled performances; fate changes pitches; 102400 generated events in bounds; independent voice FX buses; stereo pans -0.82/+0.82; 90-second finish; continuous loop with fresh motif.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
