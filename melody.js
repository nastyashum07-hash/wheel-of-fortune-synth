"use strict";
// A reproducible musical random stream, independent of visual animation and FX.
class FortuneMelody {
  constructor(seed, transpose) {
    this.seed = seed >>> 0;
    this.state = this.seed;
    this.phrase = -1;
    this.transpose =
      transpose === undefined ? [-2, 0, 3, 5][this.integer(4)] : transpose;
    this.motifs = [this.makeMotif(false), this.makeMotif(true)];
  }
  random() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  integer(n) {
    return Math.floor(this.random() * n);
  }
  makeMotif(high) {
    let n = high ? 3 + this.integer(3) : 0;
    const motif = [];
    for (let j = 0; j < 8; j++) {
      if (j === 0) n = high ? 4 : 0;
      else n = Math.max(0, Math.min(7, n + [-2, -1, 0, 1, 2][this.integer(5)]));
      motif.push(n);
    }
    return motif;
  }
  next(voice, beat, fate, progress = 0) {
    const f = Math.max(0, Math.min(1, fate)),
      phrase = Math.floor(beat / 8);
    if (phrase !== this.phrase) {
      if (this.phrase >= 0)
        for (const motif of this.motifs)
          for (let j = 1; j < 8; j++)
            if (this.random() < f * 0.65)
              motif[j] = Math.max(
                0,
                Math.min(
                  7,
                  motif[j] +
                    (this.random() < 0.5 ? -1 : 1) *
                      (1 + this.integer(1 + Math.floor(f * 3))),
                ),
              );
      this.phrase = phrase;
    }
    let pitch = this.motifs[voice][beat % 8];
    if (this.random() < f * 0.8) {
      const span = 1 + Math.floor(f * 5);
      pitch = Math.max(
        0,
        Math.min(
          7,
          pitch + (this.random() < 0.5 ? -1 : 1) * (1 + this.integer(span)),
        ),
      );
    }
    // As the ending approaches, phrases settle on the tonic/fifth without restarting audio.
    const resolution = Math.max(0, Math.min(1, (progress - 0.82) / 0.13));
    if (this.random() < resolution) pitch = voice ? (beat % 2 ? 3 : 5) : 0;
    return { pitch, level: 1 - f * 0.18 + this.random() * f * 0.18 };
  }
}
