// Tracks a sustained interaction: call trigger(true) while the gesture is
// actively satisfied and trigger(false) when it lapses. A lapse shorter than
// graceMs is bridged (the combo keeps running); a longer lapse resets it.
// onWin fires once winMs of combo time has elapsed.
export class ComboTimer {
  constructor({ graceMs, winMs, onSustainStart, onSustainEnd, onWin }) {
    this.graceMs = graceMs;
    this.winMs = winMs;
    this.onSustainStart = onSustainStart;
    this.onSustainEnd = onSustainEnd;
    this.onWin = onWin;
    this.comboStart = null;
    this.graceTimeout = null;
    this.winTimeout = null;
    this.sustaining = false;
  }

  trigger(isActive) {
    if (isActive) {
      if (this.graceTimeout) {
        clearTimeout(this.graceTimeout);
        this.graceTimeout = null;
      }
      if (this.comboStart === null) {
        this.comboStart = performance.now();
        this.winTimeout = setTimeout(() => this.win(), this.winMs);
      }
      if (!this.sustaining) {
        this.sustaining = true;
        this.onSustainStart?.();
      }
    } else if (this.comboStart !== null && !this.graceTimeout) {
      this.graceTimeout = setTimeout(() => this.reset(), this.graceMs);
    }
  }

  reset() {
    this.comboStart = null;
    this.graceTimeout = null;
    clearTimeout(this.winTimeout);
    this.winTimeout = null;
    if (this.sustaining) {
      this.sustaining = false;
      this.onSustainEnd?.();
    }
  }

  win() {
    this.comboStart = null;
    this.graceTimeout = null;
    this.winTimeout = null;
    this.sustaining = false;
    this.onSustainEnd?.();
    this.onWin?.();
  }

  destroy() {
    clearTimeout(this.graceTimeout);
    clearTimeout(this.winTimeout);
  }
}
