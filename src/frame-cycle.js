import { replaceInlineSVG } from './svg-loader.js';

// Cycles a set of DOM slots through a sequence of SVG frame files while
// playing, reverting all slots to restFrame when stopped.
export class FrameCycler {
  constructor(slots, { frames, restFrame, intervalMs }) {
    this.slots = slots;
    this.frames = frames;
    this.restFrame = restFrame;
    this.intervalMs = intervalMs;
    this.playing = false;
    this.frameIndex = 0;
    this.timer = null;
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    this.frameIndex = 0;
    this.tick();
  }

  async tick() {
    if (!this.playing) return;
    const path = this.frames[this.frameIndex % this.frames.length];
    this.frameIndex++;
    await Promise.all(this.slots.map((slot) => replaceInlineSVG(path, slot)));
    if (!this.playing) return;
    this.timer = setTimeout(() => this.tick(), this.intervalMs);
  }

  stop() {
    this.playing = false;
    clearTimeout(this.timer);
    for (const slot of this.slots) {
      replaceInlineSVG(this.restFrame, slot);
    }
  }
}
