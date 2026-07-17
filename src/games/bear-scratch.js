import { loadInlineSVG } from '../svg-loader.js';
import { ComboTimer } from '../combo-timer.js';

const BEAR_VIEWBOX = { width: 704.07, height: 774.61 };
const GRACE_MS = 1000; // window to bridge between scratch strokes without going idle
const WIN_MS = 5000; // total scratching time to win
const MOVE_DEBOUNCE_MS = 120; // how long a stroke can pause before counting as "stopped"
const DROP_DELAY_MS = 1000; // how long scratching must continue before the head drops
const LOWERED_Y = 370; // keeps the head within the viewBox (max ~413 before it clips) — adjust once seen live
const MIN_FINGERS = 2; // scratching requires at least this many simultaneous touches

export class BearScratch {
  static label = 'Bear Scratch';
  static navColor = '#fdf3be';

  constructor(container, { onComplete }) {
    this.container = container;
    this.onComplete = onComplete;
    this.unbindFns = [];
    this.activePointers = new Set();
    this.moveDebounce = null;
    this.bootstrapIdleTimer = null;
    this.dropTimer = null;
    this.isScratching = null; // face state; null so the first call always applies
    this.isDropped = null; // head-position state
    this.resizeHandler = () => {
      this.sizeBear();
      this.positionCaption();
    };

    this.combo = new ComboTimer({
      graceMs: GRACE_MS,
      winMs: WIN_MS,
      onSustainStart: () => this.startScratching(),
      onSustainEnd: () => this.stopScratching(),
      onWin: () => this.onComplete(),
    });
  }

  async mount() {
    this.container.classList.add('bear-scratch');

    const caption = document.createElement('p');
    caption.className = 'bear-scratch__caption';
    caption.textContent = "scratch the bear's back! it's itchy!";
    this.container.appendChild(caption);
    this.caption = caption;

    const bear = document.createElement('div');
    bear.className = 'bear-scratch__bear';
    this.container.appendChild(bear);
    this.bear = bear;

    const root = await loadInlineSVG('Assets/SVG/bear.svg', bear);
    this.headHappy = root.querySelector('#bear_happy');
    this.headAngry = root.querySelector('#bear_angry');
    this.backZone = root.querySelector('#back');

    this.headHappy.style.transition = 'transform 400ms ease';
    this.headAngry.style.transition = 'transform 400ms ease';

    this.setFace(true); // bear_happy is the initial state
    this.setHeadDropped(false);

    const handleDown = (event) => {
      this.activePointers.add(event.pointerId);
    };
    const handleUp = (event) => {
      this.activePointers.delete(event.pointerId);
    };
    const handleMove = (event) => {
      if (this.activePointers.size < MIN_FINGERS) return;
      if (!(event.pressure > 0 || event.buttons > 0)) return;
      clearTimeout(this.bootstrapIdleTimer);
      this.combo.trigger(true);
      clearTimeout(this.moveDebounce);
      this.moveDebounce = setTimeout(() => this.combo.trigger(false), MOVE_DEBOUNCE_MS);
    };

    this.backZone.addEventListener('pointerdown', handleDown);
    this.backZone.addEventListener('pointerup', handleUp);
    this.backZone.addEventListener('pointercancel', handleUp);
    this.backZone.addEventListener('pointermove', handleMove);
    this.unbindFns.push(() => {
      this.backZone.removeEventListener('pointerdown', handleDown);
      this.backZone.removeEventListener('pointerup', handleUp);
      this.backZone.removeEventListener('pointercancel', handleUp);
      this.backZone.removeEventListener('pointermove', handleMove);
    });

    // ComboTimer's onSustainEnd only fires after a sustain has actually
    // started, so it can't cover "user never scratched at all" — this
    // one-off bootstrap timer handles just that first idle transition;
    // every later one goes through ComboTimer normally via the debounce
    // above.
    this.bootstrapIdleTimer = setTimeout(() => {
      if (this.combo.activeSince === null) this.stopScratching();
    }, GRACE_MS);

    this.sizeBear();
    this.positionCaption();
    window.addEventListener('resize', this.resizeHandler);
  }

  // Fits the bear within 90% width and 80% viewport height (letterboxing
  // whichever dimension is more restrictive), computed in JS rather than
  // CSS aspect-ratio for the same compatibility reasoning as the baby.
  sizeBear() {
    const maxWidth = window.innerWidth * 0.9;
    const maxHeight = window.innerHeight * 0.8;
    const aspect = BEAR_VIEWBOX.height / BEAR_VIEWBOX.width;
    let width = maxWidth;
    let height = width * aspect;
    if (height > maxHeight) {
      height = maxHeight;
      width = height / aspect;
    }
    this.bear.style.width = `${width}px`;
    this.bear.style.height = `${height}px`;
  }

  // Centers the caption in the gap between the nav and the bear's top edge.
  positionCaption() {
    const bearTop = this.bear.getBoundingClientRect().top;
    const containerTop = this.container.getBoundingClientRect().top;
    const midpoint = (bearTop - containerTop) / 2;
    this.caption.style.top = `${midpoint}px`;
  }

  // Face swaps instantly; the head only drops after a further beat of
  // sustained scratching, per Jonathan's note.
  startScratching() {
    this.setFace(true);
    clearTimeout(this.dropTimer);
    this.dropTimer = setTimeout(() => this.setHeadDropped(true), DROP_DELAY_MS);
  }

  stopScratching() {
    this.setFace(false);
    clearTimeout(this.dropTimer);
    this.setHeadDropped(false);
  }

  setFace(scratching) {
    if (this.isScratching === scratching) return;
    this.isScratching = scratching;
    this.headHappy.style.display = scratching ? '' : 'none';
    this.headAngry.style.display = scratching ? 'none' : '';
  }

  setHeadDropped(dropped) {
    if (this.isDropped === dropped) return;
    this.isDropped = dropped;
    const y = dropped ? LOWERED_Y : 0;
    this.headHappy.setAttribute('transform', `translate(0, ${y})`);
    this.headAngry.setAttribute('transform', `translate(0, ${y})`);
  }

  destroy() {
    window.removeEventListener('resize', this.resizeHandler);
    clearTimeout(this.moveDebounce);
    clearTimeout(this.bootstrapIdleTimer);
    clearTimeout(this.dropTimer);
    this.combo.destroy();
    for (const unbind of this.unbindFns) unbind();
  }
}
