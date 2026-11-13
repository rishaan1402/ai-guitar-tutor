/*
 * AI Guitar Tutor capture worklet.
 *
 * Runs on the audio rendering thread, so a busy main thread (the listening
 * stage's canvas + FFT reads) can no longer make capture drop audio the way
 * ScriptProcessorNode did. Collects 128-frame render quanta into 2048-frame
 * blocks and posts each one (transferring its buffer) with the frame index of
 * its first sample, so the main thread can still verify continuity.
 */
const BLOCK = 2048;

class AgtCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(BLOCK);
    this.n = 0;
    this.start = 0;
    this.alive = true;
    this.port.onmessage = (e) => {
      if (e.data === "stop") this.alive = false;
    };
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      let i = 0;
      while (i < ch.length) {
        if (this.n === 0) this.start = currentFrame + i;
        const k = Math.min(ch.length - i, BLOCK - this.n);
        this.buf.set(ch.subarray(i, i + k), this.n);
        this.n += k;
        i += k;
        if (this.n === BLOCK) {
          const out = this.buf;
          this.port.postMessage({ frame: this.start, buf: out }, [out.buffer]);
          this.buf = new Float32Array(BLOCK);
          this.n = 0;
        }
      }
    }
    return this.alive;
  }
}

registerProcessor("agt-capture", AgtCapture);
