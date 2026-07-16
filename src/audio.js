export class ChordSynth {
  constructor() {
    this.synth = null;
  }

  async ensureStarted() {
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    if (!this.synth) {
      this.synth = new Tone.PolySynth(Tone.Synth).toDestination();
    }
  }

  async noteOn(note) {
    await this.ensureStarted();
    this.synth.triggerAttack(note);
  }

  noteOff(note) {
    this.synth?.triggerRelease(note);
  }

  releaseAll() {
    this.synth?.releaseAll();
  }
}
