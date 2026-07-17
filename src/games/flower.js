import { loadInlineSVG } from '../svg-loader.js';

const FLOWER_VIEWBOX = { width: 358.08, height: 617.2 };
const PETAL_KEYS = ['petal1', 'petal2', 'petal3', 'petal4', 'petal5', 'petal6'];

const STEM_HITBOX_PADDING_PX = 40;
const PETAL_HITBOX_PADDING_PX = 30;

const PETAL_FLOAT_DIST = 140; // px a plucked petal drifts outward before it's gone
const PETAL_LIFT_PX = 70; // extra upward drift, on top of the outward direction, for a floaty feel
const PETAL_FADE_MS = 600;

const FALL_MS = 500; // whole flower dropping out of view after a failed grip
const REGROW_PAUSE_MS = 400; // beat where the flower is fully gone before it grows back
const GROW_MS = 700; // new flower rising back into place

export class Flower {
  static label = 'Flower';
  static navColor = '#fdf3be';

  constructor(container, { onComplete }) {
    this.container = container;
    this.onComplete = onComplete;
    this.unbindFns = [];
    this.resizeHandler = () => {
      this.sizeFlower();
      this.positionCaption();
      this.sizeHitboxes();
    };

    this.stemHeld = false;
    this.stemPointerId = null;
    this.petalPointers = new Map(); // petalKey -> pointerId currently touching it
    this.removedPetals = new Set();
    this.pluckedCount = 0;
    this.won = false;
    this.falling = false;
    this.fallTimer = null;
    this.regrowTimer = null;
  }

  async mount() {
    this.container.classList.add('flower-game');

    const caption = document.createElement('p');
    caption.className = 'flower-game__caption';
    caption.textContent = 'pick the flower! pluck the petals!';
    this.container.appendChild(caption);
    this.caption = caption;

    const flowerEl = document.createElement('div');
    flowerEl.className = 'flower-game__flower';
    this.container.appendChild(flowerEl);
    this.flowerEl = flowerEl;

    const root = await loadInlineSVG('Assets/SVG/flower_group.svg', flowerEl);
    this.stem = root.querySelector('#stem');
    this.petals = Object.fromEntries(PETAL_KEYS.map((key) => [key, root.querySelector(`#${key}`)]));
    const bud = root.querySelector('#flowerbud');

    // Fade/drift is CSS-transitioned on the SVG transform attribute (not the
    // CSS transform property) - this exact combination (transition set on
    // .style, value applied via setAttribute) is the one already verified
    // working on real iOS 15 WebKit for the bear's head-drop.
    for (const petal of Object.values(this.petals)) {
      petal.style.transition = `transform ${PETAL_FADE_MS}ms ease-out, opacity ${PETAL_FADE_MS}ms ease-out`;
    }

    const budCenter = this.centerOf(bud);
    this.petalDirections = {};
    for (const key of PETAL_KEYS) {
      const center = this.centerOf(this.petals[key]);
      const dx = center.x - budCenter.x;
      const dy = center.y - budCenter.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      this.petalDirections[key] = { x: dx / len, y: dy / len };
    }

    this.stemHitbox = this.makeHitbox(flowerEl, 'flower-game__stem-hitbox');
    this.petalHitboxes = Object.fromEntries(
      PETAL_KEYS.map((key) => [key, this.makeHitbox(flowerEl, 'flower-game__petal-hitbox')])
    );

    this.bindStem();
    for (const key of PETAL_KEYS) this.bindPetal(key);

    this.sizeFlower();
    this.positionCaption();
    this.sizeHitboxes();
    window.addEventListener('resize', this.resizeHandler);
  }

  makeHitbox(parent, className) {
    const hitbox = document.createElement('div');
    hitbox.className = className;
    parent.appendChild(hitbox);
    return hitbox;
  }

  centerOf(el) {
    const bbox = el.getBBox();
    return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
  }

  bindStem() {
    const handleDown = (event) => {
      if (this.falling || this.stemHeld) return;
      this.stemHeld = true;
      this.stemPointerId = event.pointerId;
    };
    const handleUp = (event) => {
      if (event.pointerId !== this.stemPointerId) return;
      this.stemHeld = false;
      this.stemPointerId = null;
      if (!this.won) this.triggerFail();
    };

    this.stemHitbox.addEventListener('pointerdown', handleDown);
    this.stemHitbox.addEventListener('pointerup', handleUp);
    this.stemHitbox.addEventListener('pointercancel', handleUp);
    this.unbindFns.push(() => {
      this.stemHitbox.removeEventListener('pointerdown', handleDown);
      this.stemHitbox.removeEventListener('pointerup', handleUp);
      this.stemHitbox.removeEventListener('pointercancel', handleUp);
    });
  }

  bindPetal(key) {
    const hitbox = this.petalHitboxes[key];
    const handleDown = (event) => {
      if (this.falling || !this.stemHeld || this.removedPetals.has(key)) return;
      if (event.pointerId === this.stemPointerId) return;
      if (this.petalPointers.has(key)) return;
      this.petalPointers.set(key, event.pointerId);
    };
    const handleUp = (event) => {
      if (this.petalPointers.get(key) !== event.pointerId) return;
      this.petalPointers.delete(key);
      if (!this.removedPetals.has(key)) this.removePetal(key);
    };

    hitbox.addEventListener('pointerdown', handleDown);
    hitbox.addEventListener('pointerup', handleUp);
    hitbox.addEventListener('pointercancel', handleUp);
    this.unbindFns.push(() => {
      hitbox.removeEventListener('pointerdown', handleDown);
      hitbox.removeEventListener('pointerup', handleUp);
      hitbox.removeEventListener('pointercancel', handleUp);
    });
  }

  // A petal is only actually plucked once the finger touching it lifts -
  // while it's held it just sits there, per Jonathan's spec.
  removePetal(key) {
    this.removedPetals.add(key);
    this.petalHitboxes[key].style.pointerEvents = 'none';

    const dir = this.petalDirections[key];
    const dx = dir.x * PETAL_FLOAT_DIST;
    const dy = dir.y * PETAL_FLOAT_DIST - PETAL_LIFT_PX;
    this.petals[key].setAttribute('transform', `translate(${dx}, ${dy})`);
    this.petals[key].style.opacity = '0';

    this.pluckedCount++;
    if (this.pluckedCount >= PETAL_KEYS.length) {
      this.won = true;
      setTimeout(() => this.onComplete(), PETAL_FADE_MS);
    }
  }

  // Letting go of the stem before all petals are gone drops the whole
  // flower off the bottom of the screen; after a beat, a fresh flower grows
  // back up into the same spot and play can start over.
  triggerFail() {
    if (this.falling) return;
    this.falling = true;
    this.flowerEl.style.pointerEvents = 'none';
    this.petalPointers.clear();

    this.flowerEl.style.transition = `transform ${FALL_MS}ms ease-in, opacity ${FALL_MS}ms ease-in`;
    this.flowerEl.style.transform = 'translate(-50%, 100%)';
    this.flowerEl.style.opacity = '0';

    this.fallTimer = setTimeout(() => {
      this.resetPetals();
      this.regrowTimer = setTimeout(() => this.grow(), REGROW_PAUSE_MS);
    }, FALL_MS);
  }

  resetPetals() {
    this.removedPetals.clear();
    this.petalPointers.clear();
    this.pluckedCount = 0;
    for (const key of PETAL_KEYS) {
      this.petals[key].style.transition = 'none';
      this.petals[key].setAttribute('transform', 'translate(0, 0)');
      this.petals[key].style.opacity = '1';
      // Force the reset to apply before transitions are re-enabled, so the
      // next pluck's fade doesn't animate from the old removed position.
      this.petals[key].getBoundingClientRect();
      this.petals[key].style.transition = `transform ${PETAL_FADE_MS}ms ease-out, opacity ${PETAL_FADE_MS}ms ease-out`;
      this.petalHitboxes[key].style.pointerEvents = '';
    }
  }

  grow() {
    this.flowerEl.style.opacity = '1';
    this.flowerEl.style.transition = `transform ${GROW_MS}ms ease-out`;
    this.flowerEl.style.transform = 'translate(-50%, 0)';

    this.regrowTimer = setTimeout(() => {
      this.falling = false;
      this.flowerEl.style.pointerEvents = '';
    }, GROW_MS);
  }

  // Fits within 50% of viewport height, anchored to the bottom edge.
  sizeFlower() {
    const height = window.innerHeight * 0.5;
    const width = height * (FLOWER_VIEWBOX.width / FLOWER_VIEWBOX.height);
    this.flowerEl.style.width = `${width}px`;
    this.flowerEl.style.height = `${height}px`;
  }

  // Centers the caption in the gap between the nav and the flower's top edge.
  positionCaption() {
    const flowerTop = this.flowerEl.getBoundingClientRect().top;
    const containerTop = this.container.getBoundingClientRect().top;
    const midpoint = (flowerTop - containerTop) / 2;
    this.caption.style.top = `${midpoint}px`;
  }

  sizeHitboxes() {
    const renderedWidth = this.flowerEl.getBoundingClientRect().width;
    const scale = renderedWidth / FLOWER_VIEWBOX.width;
    this.sizeHitbox(this.stemHitbox, this.stem, scale, STEM_HITBOX_PADDING_PX);
    for (const key of PETAL_KEYS) {
      this.sizeHitbox(this.petalHitboxes[key], this.petals[key], scale, PETAL_HITBOX_PADDING_PX);
    }
  }

  sizeHitbox(hitbox, el, scale, paddingPx) {
    const bbox = el.getBBox();
    const center = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
    hitbox.style.width = `${bbox.width * scale + paddingPx * 2}px`;
    hitbox.style.height = `${bbox.height * scale + paddingPx * 2}px`;
    hitbox.style.left = `${(center.x / FLOWER_VIEWBOX.width) * 100}%`;
    hitbox.style.top = `${(center.y / FLOWER_VIEWBOX.height) * 100}%`;
  }

  destroy() {
    window.removeEventListener('resize', this.resizeHandler);
    clearTimeout(this.fallTimer);
    clearTimeout(this.regrowTimer);
    for (const unbind of this.unbindFns) unbind();
  }
}
