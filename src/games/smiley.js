import { loadInlineSVG } from '../svg-loader.js';

const SMILEY_VIEWBOX = { width: 637.92, height: 445.49 };
const MAX_ROTATION = 180; // degrees, either direction
const HITBOX_PADDING_PX = 50; // flat screen-pixel buffer, doesn't scale with the smiley

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
      this.sizeMouthHitbox();
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
    // A rotating shape's on-screen footprint changes with its angle (wide
    // and short at 0deg, tall and narrow at 90deg, etc). Sizing the hitbox
    // to the bbox's diagonal — a circle of that radius fully contains the
    // shape at every possible rotation — means it never needs to track the
    // mouth's rotation, only the pivot point, which never moves.
    this.mouthDiagonal = Math.sqrt(bbox.width ** 2 + bbox.height ** 2);
    this.applyRotation();

    const hitbox = document.createElement('div');
    hitbox.className = 'smiley-game__mouth-hitbox';
    smileyEl.appendChild(hitbox);
    this.hitbox = hitbox;

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

    hitbox.addEventListener('pointerdown', handleDown);
    hitbox.addEventListener('pointermove', handleMove);
    hitbox.addEventListener('pointerup', handleUp);
    hitbox.addEventListener('pointercancel', handleUp);
    this.unbindFns.push(() => {
      hitbox.removeEventListener('pointerdown', handleDown);
      hitbox.removeEventListener('pointermove', handleMove);
      hitbox.removeEventListener('pointerup', handleUp);
      hitbox.removeEventListener('pointercancel', handleUp);
    });

    this.sizeSmiley();
    this.positionCaption();
    this.sizeMouthHitbox();
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

  // Centers a square hitbox on the mouth's pivot, sized to its rendered
  // diagonal (so it covers the mouth at any rotation) plus a flat 50px
  // screen-pixel buffer that stays constant regardless of the smiley's
  // current scale.
  sizeMouthHitbox() {
    const renderedWidth = this.smileyEl.getBoundingClientRect().width;
    const scale = renderedWidth / SMILEY_VIEWBOX.width;
    const sizePx = this.mouthDiagonal * scale + HITBOX_PADDING_PX * 2;
    this.hitbox.style.width = `${sizePx}px`;
    this.hitbox.style.height = `${sizePx}px`;
    this.hitbox.style.left = `${(this.pivot.x / SMILEY_VIEWBOX.width) * 100}%`;
    this.hitbox.style.top = `${(this.pivot.y / SMILEY_VIEWBOX.height) * 100}%`;
  }

  destroy() {
    window.removeEventListener('resize', this.resizeHandler);
    for (const unbind of this.unbindFns) unbind();
  }
}
