import { loadInlineSVG, replaceInlineSVG, setState } from '../svg-loader.js';
import { ChordSynth } from '../audio.js';

const NATURALS = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'];
const SHARPS = [
  { note: 'C#4', afterIndex: 0 },
  { note: 'D#4', afterIndex: 1 },
  { note: 'F#4', afterIndex: 3 },
  { note: 'G#4', afterIndex: 4 },
  { note: 'A#4', afterIndex: 5 },
];

const DANCE_FRAMES = ['Assets/SVG/ant_dance1.svg', 'Assets/SVG/ant_dance2.svg'];
const REST_FRAME = 'Assets/SVG/ant_rest.svg';
const GRACE_MS = 1000; // window to bridge between chords without resetting the combo
const WIN_MS = 10000; // total time to hold a running combo to win
const DANCE_FRAME_MS = 220;

export class AntDance {
  static label = 'Ant Dance';

  constructor(container, { onComplete }) {
    this.container = container;
    this.onComplete = onComplete;
    this.synth = new ChordSynth();
    this.heldNotes = new Set();
    this.antSlots = [];
    this.dancing = false;
    this.danceFrameIndex = 0;
    this.danceFrameTimer = null;
    this.comboStart = null;
    this.graceTimeout = null;
    this.winTimeout = null;
  }

  async mount() {
    this.container.classList.add('ant-dance');

    const antsRow = document.createElement('div');
    antsRow.className = 'ant-dance__ants';
    this.container.appendChild(antsRow);

    for (let i = 0; i < 3; i++) {
      const slot = document.createElement('div');
      slot.className = 'ant-dance__ant';
      antsRow.appendChild(slot);
      await loadInlineSVG(REST_FRAME, slot);
      this.antSlots.push(slot);
    }

    const keyboard = document.createElement('div');
    keyboard.className = 'ant-dance__keyboard';
    this.container.appendChild(keyboard);

    const naturalsRow = document.createElement('div');
    naturalsRow.className = 'ant-dance__naturals';
    keyboard.appendChild(naturalsRow);

    for (const note of NATURALS) {
      const slot = document.createElement('div');
      slot.className = 'ant-dance__key ant-dance__key--natural';
      naturalsRow.appendChild(slot);
      const root = await loadInlineSVG('Assets/SVG/key.svg', slot);
      this.bindKey(slot, root, note, false);
    }

    for (const { note, afterIndex } of SHARPS) {
      const slot = document.createElement('div');
      slot.className = 'ant-dance__key ant-dance__key--sharp';
      slot.style.left = `${((afterIndex + 1) / NATURALS.length) * 100}%`;
      keyboard.appendChild(slot);
      const root = await loadInlineSVG('Assets/SVG/key_sharp.svg', slot);
      this.bindKey(slot, root, note, true);
    }
  }

  bindKey(slot, svgRoot, note, isSharp) {
    const stateIds = isSharp
      ? ['key_sharp_inactive', 'key_sharp_active']
      : ['key_inactive', 'key_active'];
    const [inactiveId, activeId] = stateIds;

    const press = (event) => {
      event.preventDefault();
      if (this.heldNotes.has(note)) return;
      slot.setPointerCapture(event.pointerId);
      this.heldNotes.add(note);
      setState(svgRoot, stateIds, activeId);
      this.synth.noteOn(note);
      this.evaluateChord();
    };

    const release = () => {
      if (!this.heldNotes.has(note)) return;
      this.heldNotes.delete(note);
      setState(svgRoot, stateIds, inactiveId);
      this.synth.noteOff(note);
      this.evaluateChord();
    };

    slot.addEventListener('pointerdown', press);
    slot.addEventListener('pointerup', release);
    slot.addEventListener('pointercancel', release);
  }

  evaluateChord() {
    const isChord = this.heldNotes.size >= 2;

    if (isChord) {
      if (this.graceTimeout) {
        clearTimeout(this.graceTimeout);
        this.graceTimeout = null;
      }
      if (this.comboStart === null) {
        this.comboStart = performance.now();
        this.winTimeout = setTimeout(() => this.win(), WIN_MS);
      }
      this.startDancing();
    } else if (this.comboStart !== null && !this.graceTimeout) {
      this.graceTimeout = setTimeout(() => this.resetCombo(), GRACE_MS);
    }
  }

  startDancing() {
    if (this.dancing) return;
    this.dancing = true;
    this.danceFrameIndex = 0;
    this.tickDanceFrame();
  }

  async tickDanceFrame() {
    if (!this.dancing) return;
    const path = DANCE_FRAMES[this.danceFrameIndex % DANCE_FRAMES.length];
    this.danceFrameIndex++;
    await Promise.all(this.antSlots.map((slot) => replaceInlineSVG(path, slot)));
    if (!this.dancing) return;
    this.danceFrameTimer = setTimeout(() => this.tickDanceFrame(), DANCE_FRAME_MS);
  }

  stopDancing() {
    this.dancing = false;
    clearTimeout(this.danceFrameTimer);
    for (const slot of this.antSlots) {
      replaceInlineSVG(REST_FRAME, slot);
    }
  }

  resetCombo() {
    this.comboStart = null;
    this.graceTimeout = null;
    clearTimeout(this.winTimeout);
    this.winTimeout = null;
    this.stopDancing();
  }

  win() {
    this.comboStart = null;
    this.graceTimeout = null;
    this.winTimeout = null;
    this.stopDancing();
    this.onComplete();
  }

  destroy() {
    this.dancing = false;
    clearTimeout(this.danceFrameTimer);
    clearTimeout(this.graceTimeout);
    clearTimeout(this.winTimeout);
    this.synth.releaseAll();
  }
}
