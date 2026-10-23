// Shared instrument state and bounded controls.
"use strict";
const $ = (s) => document.querySelector(s),
  clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const DURATION = 90;
const S = {
  playing: false,
  auto: false,
  loop: false,
  time: 0,
  bpm: 70,
  fate: 0.1,
  cutoff: 0.25,
  attack: 0.48,
  decay: 0.5,
  sustain: 0.7,
  release: 0.8,
  master: 0.55,
  vol: [0.6, 0.02],
  voices: [true, false],
  fx: { reverb: 0.65, delay: 0.45, chorus: 0, drive: 0 },
  steps: [true, true, true, true],
};
let ctx,
  out,
  filter,
  compressor,
  analyser,
  data,
  buses = [],
  next = 0,
  beat = 0,
  epoch = 0,
  angle = 0,
  velocity = 0,
  finishing = false,
  muted = false,
  frameTime = 0,
  lastAudio = 0;
const ui = {},
  figures = {},
  touches = new Map(),
  symbolValues = {};
const controlDirections = {};
function nextControlValue(id, value, step = 0.1) {
  let direction = controlDirections[id] || 1;
  if (value >= 1) direction = -1;
  else if (value <= 0) direction = 1;
  const next = clamp(Math.round((value + direction * step) * 100) / 100);
  controlDirections[id] = next >= 1 ? -1 : next <= 0 ? 1 : direction;
  return next;
}
function controlAction(id, value) {
  return value >= 1 || (value > 0 && controlDirections[id] === -1)
    ? "уменьшить"
    : "увеличить";
}
function touch(k) {
  touches.set(k, performance.now() + 7000);
}
