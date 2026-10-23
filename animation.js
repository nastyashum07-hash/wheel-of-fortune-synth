// Wheel motion and live output level.
function frame(t) {
  let dt = Math.min(0.05, (t - frameTime) / 1000 || 0);
  frameTime = t;
  const fate = clamp(S.fate),
    chaos = fate * fate;
  if (t >= chaosNext) {
    chaosSign = Math.random() < 0.85 ? -chaosSign : chaosSign;
    chaosTarget = chaosSign * (30 + Math.random() * 230) * chaos;
    chaosNext = t + (140 + Math.random() * 360) + (1 - fate) * 1800;
  }
  chaosSpeed +=
    (chaosTarget - chaosSpeed) * (1 - Math.exp(-dt * (2 + fate * 24)));
  if (!wheelDragging) {
    angle +=
      dt * ((S.playing ? S.bpm * 0.11 : 3) * (1 - fate) + chaosSpeed * fate);
    angle += velocity * dt * 30;
  }
  velocity *= Math.exp(-dt * 3);
  $("#wheelArt").style.transform = `rotate(${angle}deg)`;
  if (ctx && !S.playing && !finishing && t - lastAudio > 150) {
    applyAudio();
    lastAudio = t;
  }
  if (analyser) {
    analyser.getFloatTimeDomainData(data);
    const rms = Math.sqrt(data.reduce((a, v) => a + v * v, 0) / data.length);
    $("#stage").dataset.signal = rms.toFixed(5);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
