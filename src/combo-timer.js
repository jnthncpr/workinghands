// Tracks a sustained interaction: call trigger(true) while the gesture is
// actively satisfied and trigger(false) when it lapses. A lapse shorter than
// graceMs is bridged (the combo keeps running). A longer lapse pauses the
// clock — accumulated active time is preserved, not lost — and resumes
// counting from where it left off once trigger(true) fires again.
// onWin fires once winMs of cumulative *active* time has elapsed.
export class ComboTimer {
  constructor({ graceMs, winMs, onSustainStart, onSustainEnd, onWin }) {
    this.graceMs = graceMs;
    this.winMs = winMs;
    this.onSustainStart = onSustainStart;
    this.onSustainEnd = onSustainEnd;
    this.onWin = onWin;
    this.elapsedMs = 0; // banked active time from prior stretches
    this.activeSince = null; // start of the current active stretch, or null if paused
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
      if (this.activeSince === null) {
        this.activeSince = performance.now();
        this.winTimeout = setTimeout(() => this.win(), this.winMs - this.elapsedMs);
      }
      if (!this.sustaining) {
        this.sustaining = true;
        this.onSustainStart?.();
      }
    } else if (this.activeSince !== null && !this.graceTimeout) {
      this.graceTimeout = setTimeout(() => this.pause(), this.graceMs);
    }
  }

  // Grace period elapsed without activity resuming: bank the elapsed active
  // time and fire the "stopped" visual callback, but keep the progress —
  // the next trigger(true) resumes counting rather than starting over.
  pause() {
    this.graceTimeout = null;
    if (this.activeSince !== null) {
      this.elapsedMs += performance.now() - this.activeSince;
      this.activeSince = null;
    }
    clearTimeout(this.winTimeout);
    this.winTimeout = null;
    if (this.sustaining) {
      this.sustaining = false;
      this.onSustainEnd?.();
    }
  }

  win() {
    this.elapsedMs = this.winMs;
    this.activeSince = null;
    clearTimeout(this.graceTimeout);
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
