import { loadInlineSVG, setState } from '../svg-loader.js';
import { ChordSynth } from '../audio.js';
import { bindPressZone } from '../gesture.js';
import { ComboTimer } from '../combo-timer.js';
import { FrameCycler } from '../frame-cycle.js';

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
const WIN_MS = 10000; // total combo time to win
const DANCE_FRAME_MS = 220;

export class AntDance {
  static label = 'Ant Dance';

  constructor(container, { onComplete }) {
    this.container = container;
    this.onComplete = onComplete;
    this.synth = new ChordSynth();
    this.heldNotes = new Set();
    this.unbindFns = [];
    this.dancers = null;

    this.combo = new ComboTimer({
      graceMs: GRACE_MS,
      winMs: WIN_MS,
      onSustainStart: () => this.dancers.start(),
      onSustainEnd: () => this.dancers.stop(),
      onWin: () => this.onComplete(),
    });
  }

  async mount() {
    this.container.classList.add('ant-dance');

    const antsRow = document.createElement('div');
    antsRow.className = 'ant-dance__ants';
    this.container.appendChild(antsRow);

    const antSlots = [];
    for (let i = 0; i < 3; i++) {
      const slot = document.createElement('div');
      slot.className = 'ant-dance__ant';
      antsRow.appendChild(slot);
      await loadInlineSVG(REST_FRAME, slot);
      antSlots.push(slot);
    }

    this.dancers = new FrameCycler(antSlots, {
      frames: DANCE_FRAMES,
      restFrame: REST_FRAME,
      intervalMs: DANCE_FRAME_MS,
    });

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

    const unbind = bindPressZone(slot, {
      onPress: () => {
        if (this.heldNotes.has(note)) return;
        this.heldNotes.add(note);
        setState(svgRoot, stateIds, activeId);
        this.synth.noteOn(note);
        this.combo.trigger(this.heldNotes.size >= 2);
      },
      onRelease: () => {
        if (!this.heldNotes.has(note)) return;
        this.heldNotes.delete(note);
        setState(svgRoot, stateIds, inactiveId);
        this.synth.noteOff(note);
        this.combo.trigger(this.heldNotes.size >= 2);
      },
    });

    this.unbindFns.push(unbind);
  }

  destroy() {
    this.dancers?.stop();
    this.combo.destroy();
    this.synth.releaseAll();
    for (const unbind of this.unbindFns) unbind();
  }
}
