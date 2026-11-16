// Runs on the audio thread. Resamples the mic to 16 kHz, converts it to
// 16-bit PCM and posts ~40 ms chunks, plus an RMS level for the meter and the
// local end-of-speech timer used to measure latency.
class MicCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000; // sampleRate is a worklet global
    this.pos = 0;   // read position relative to the current frame's first sample
    this.prev = 0;  // last sample of the previous frame
    this.out = new Int16Array(640); // 40 ms at 16 kHz
    this.n = 0;
    this.sum = 0;
  }
  push(v) {
    const s = Math.max(-1, Math.min(1, v));
    this.sum += s * s;
    this.out[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    if (this.n === this.out.length) {
      const rms = Math.sqrt(this.sum / this.n);
      this.port.postMessage({ pcm: this.out.buffer, rms }, [this.out.buffer]);
      this.out = new Int16Array(640);
      this.n = 0;
      this.sum = 0;
    }
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch || !ch.length) return true;
    let p = this.pos;
    for (;;) {
      const i0 = Math.floor(p);
      if (i0 + 1 >= ch.length) break;
      const s0 = i0 < 0 ? this.prev : ch[i0];
      const s1 = ch[i0 + 1];
      this.push(s0 + (s1 - s0) * (p - i0));
      p += this.ratio;
    }
    this.pos = p - ch.length;
    this.prev = ch[ch.length - 1];
    return true;
  }
}
registerProcessor('mic-capture', MicCapture);
