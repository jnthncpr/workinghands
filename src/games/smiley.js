import { loadInlineSVG } from '../svg-loader.js';

const SMILEY_VIEWBOX = { width: 637.92, height: 445.49 };
const MAX_ROTATION = 180; // degrees, either direction

export class Smiley {
  static label = 'Smiley';
  static navColor = '#fdf3be';

  constructor(container, { onComplete }) {
    this.container = container;
    this.onComplete = onComplete;
    this.unbindFns = [];
    this.resizeHandler = () => {
      this.sizeSmiley();
      this.positionCaption();
    };

    this.rotation = 0; // persists across separate 2-finger gestures — never resets on release
    this.activePointers = new Map(); // pointerId -> {x, y}
    this.gestureBaseline = null; // {angle, rotation} captured when a 2-finger grab starts
    this.won = false;
  }

  async mount() {
    this.container.classList.add('smiley-game');

    const caption = document.createElement('p');
    caption.className = 'smiley-game__caption';
    caption.textContent = 'turn that frown upside down!';
    this.container.appendChild(caption);
    this.caption = caption;

    const smileyEl = document.createElement('div');
    smileyEl.className = 'smiley-game__smiley';
    this.container.appendChild(smileyEl);
    this.smileyEl = smileyEl;

    const root = await loadInlineSVG('Assets/SVG/smiley.svg', smileyEl);
    this.mouth = root.querySelector('#mouth');

    const bbox = this.mouth.getBBox();
    this.pivot = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
    this.applyRotation();

    const handleDown = (event) => {
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.maybeStartGesture();
    };
    const handleMove = (event) => {
      if (!this.activePointers.has(event.pointerId)) return;
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.updateGesture();
    };
    const handleUp = (event) => {
      this.activePointers.delete(event.pointerId);
      // Dropping below 2 fingers ends this gesture instance, but this.rotation
      // is untouched — the next 2-finger grab starts a fresh angle reference
      // measured from wherever rotation currently sits, so play can resume
      // exactly where it left off.
      this.gestureBaseline = null;
    };

    this.mouth.addEventListener('pointerdown', handleDown);
    this.mouth.addEventListener('pointermove', handleMove);
    this.mouth.addEventListener('pointerup', handleUp);
    this.mouth.addEventListener('pointercancel', handleUp);
    this.unbindFns.push(() => {
      this.mouth.removeEventListener('pointerdown', handleDown);
      this.mouth.removeEventListener('pointermove', handleMove);
      this.mouth.removeEventListener('pointerup', handleUp);
      this.mouth.removeEventListener('pointercancel', handleUp);
    });

    this.sizeSmiley();
    this.positionCaption();
    window.addEventListener('resize', this.resizeHandler);
  }

  maybeStartGesture() {
    if (this.activePointers.size < 2 || this.gestureBaseline) return;
    const [p1, p2] = [...this.activePointers.values()].slice(0, 2);
    this.gestureBaseline = {
      angle: Math.atan2(p2.y - p1.y, p2.x - p1.x),
      rotation: this.rotation,
    };
  }

  updateGesture() {
    if (this.activePointers.size < 2) return;
    if (!this.gestureBaseline) {
      this.maybeStartGesture();
      return;
    }
    const [p1, p2] = [...this.activePointers.values()].slice(0, 2);
    const currentAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const deltaDeg = (currentAngle - this.gestureBaseline.angle) * (180 / Math.PI);
    const next = this.gestureBaseline.rotation + deltaDeg;
    this.rotation = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, next));
    this.applyRotation();

    if (!this.won && Math.abs(this.rotation) >= MAX_ROTATION) {
      this.won = true;
      this.onComplete();
    }
  }

  applyRotation() {
    this.mouth.setAttribute('transform', `rotate(${this.rotation}, ${this.pivot.x}, ${this.pivot.y})`);
  }

  // Fits within 90% width and 80% viewport height, same letterboxing
  // reasoning as the bear.
  sizeSmiley() {
    const maxWidth = window.innerWidth * 0.9;
    const maxHeight = window.innerHeight * 0.8;
    const aspect = SMILEY_VIEWBOX.height / SMILEY_VIEWBOX.width;
    let width = maxWidth;
    let height = width * aspect;
    if (height > maxHeight) {
      height = maxHeight;
      width = height / aspect;
    }
    this.smileyEl.style.width = `${width}px`;
    this.smileyEl.style.height = `${height}px`;
  }

  // Centers the caption in the gap between the nav and the smiley's top edge.
  positionCaption() {
    const smileyTop = this.smileyEl.getBoundingClientRect().top;
    const containerTop = this.container.getBoundingClientRect().top;
    const midpoint = (smileyTop - containerTop) / 2;
    this.caption.style.top = `${midpoint}px`;
  }

  destroy() {
    window.removeEventListener('resize', this.resizeHandler);
    for (const unbind of this.unbindFns) unbind();
  }
}
