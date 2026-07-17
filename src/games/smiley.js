import { loadInlineSVG } from '../svg-loader.js';
import { showPostScreen } from '../post-screen.js';

const POST_BACKGROUND = '#56bd7e';
const POST_ICON = '\u{1F91F}';
const POST_MESSAGE = '"Throw away holiness and wisdom and people will be a hundred times happier." – Lao Tzu';
const POST_NEXT_ACTIVE_ICON = 'Assets/SVG/next_active_green.svg';

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
    this.gestureBaseline = null; // {ids, angle, rotation} captured when a 2-finger grab starts
    this.won = false;
    this.postCleanup = null;
  }

  showPost() {
    window.removeEventListener('resize', this.resizeHandler);
    for (const unbind of this.unbindFns) unbind();
    this.unbindFns = [];

    this.container.classList.remove('smiley-game');
    this.postCleanup = showPostScreen(this.container, {
      background: POST_BACKGROUND,
      icon: POST_ICON,
      message: POST_MESSAGE,
      nextActiveIcon: POST_NEXT_ACTIVE_ICON,
      onNext: () => this.onComplete(),
    });
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
      this.updateGesture(event.pointerId);
    };
    const handleUp = (event) => {
      this.activePointers.delete(event.pointerId);
      // Only end the gesture if the finger that lifted was actually one of
      // the pinned pair driving it — an unrelated 3rd finger (e.g. a resting
      // thumb) lifting shouldn't interrupt an ongoing rotation.
      if (this.gestureBaseline?.ids.includes(event.pointerId)) {
        this.gestureBaseline = null;
      }
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
    // Pin the gesture to these two specific pointer IDs. If a 3rd finger
    // touches down later, it's ignored entirely rather than silently
    // swapped in for one of the original two if that one lifts.
    const [[id1, p1], [id2, p2]] = [...this.activePointers.entries()].slice(0, 2);
    this.gestureBaseline = {
      ids: [id1, id2],
      angle: Math.atan2(p2.y - p1.y, p2.x - p1.x),
      rotation: this.rotation,
    };
  }

  updateGesture(movedPointerId) {
    if (!this.gestureBaseline) {
      this.maybeStartGesture();
      return;
    }
    // Ignore movement from any finger that isn't part of the pinned pair.
    if (!this.gestureBaseline.ids.includes(movedPointerId)) return;
    const [id1, id2] = this.gestureBaseline.ids;
    const p1 = this.activePointers.get(id1);
    const p2 = this.activePointers.get(id2);

    const currentAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    // atan2 returns (-180, 180], so a naive subtraction can misread a real,
    // tiny rotation as a ~360 degree jump the instant the finger pair's
    // angle crosses that boundary (e.g. baseline at 179deg, next frame at
    // -179deg is actually a 2deg move, not -358deg). Taking the shortest
    // signed angular difference via atan2(sin, cos) avoids that discontinuity.
    const rawDiff = currentAngle - this.gestureBaseline.angle;
    const wrappedDiff = Math.atan2(Math.sin(rawDiff), Math.cos(rawDiff));
    const deltaDeg = wrappedDiff * (180 / Math.PI);
    const next = this.gestureBaseline.rotation + deltaDeg;
    this.rotation = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, next));
    this.applyRotation();

    if (!this.won && Math.abs(this.rotation) >= MAX_ROTATION) {
      this.won = true;
      this.showPost();
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
    this.postCleanup?.();
    for (const unbind of this.unbindFns) unbind();
  }
}
