import { loadInlineSVG } from '../svg-loader.js';

const FLOWER_VIEWBOX = { width: 358.08, height: 617.2 };
const PETAL_KEYS = ['petal1', 'petal2', 'petal3', 'petal4', 'petal5', 'petal6'];

const STEM_HITBOX_PADDING_PX = 90; // stem + leaf bbox, expanded 50px further per Jonathan's note
const PETAL_HITBOX_PADDING_PX = 30;

const PETAL_FLOAT_DIST = 140; // px (SVG units) a released petal continues drifting before it's gone
const PETAL_LIFT_PX = 70; // extra upward drift added only for a plain tap (no real drag to take a direction from)
const PETAL_FADE_MS = 600;
const MIN_DRAG_LEN = 4; // px; below this a release is treated as a tap, using the petal's natural outward direction

const DROP_DISTANCE_PX = 1200; // far enough below any viewport to read as fully gone, from wherever it was dragged
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
    this.dragOffset = { x: 0, y: 0 }; // px, added to the flower's centered rest position
    this.dragStartClient = null;
    this.dragStartOffset = null;

    this.petalPointers = new Map(); // petalKey -> pointerId currently touching it
    this.petalDragStart = {}; // petalKey -> {x, y} client coords when that touch began
    this.removedPetals = new Set();
    this.pluckedCount = 0;

    this.won = false;
    this.falling = false;
    this.fallTimer = null;
    this.regrowTimer = null;
    this.renderScale = 1;
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
    this.leaf = root.querySelector('#leaf');
    this.petals = Object.fromEntries(PETAL_KEYS.map((key) => [key, root.querySelector(`#${key}`)]));
    const bud = root.querySelector('#flowerbud');

    // Fade/drift is CSS-transitioned on the SVG transform attribute (not the
    // CSS transform property) - this exact combination (transition set on
    // .style, value applied via setAttribute) is the one already verified
    // working on real iOS 15 WebKit for the bear's head-drop.
    for (const petal of Object.values(this.petals)) {
      petal.style.transition = `transform ${PETAL_FADE_MS}ms ease-out, opacity ${PETAL_FADE_MS}ms ease-out`;
    }

    // bbox geometry is cached once here (it's invariant - only the render
    // scale changes on resize) rather than re-measured on every resize.
    this.stemBBox = this.unionBBox([this.stem, this.leaf]);
    this.petalBBoxes = Object.fromEntries(PETAL_KEYS.map((key) => [key, this.petals[key].getBBox()]));

    const budCenter = this.centerOf(bud.getBBox());
    this.petalDirections = {};
    for (const key of PETAL_KEYS) {
      const center = this.centerOf(this.petalBBoxes[key]);
      const dx = center.x - budCenter.x;
      const dy = center.y - budCenter.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      this.petalDirections[key] = { x: dx / len, y: dy / len };
    }

    // Covers the stem and leaf together - gripping either counts as picking
    // up the flower, per Jonathan's note.
    this.stemHitbox = this.makeHitbox(flowerEl, 'flower-game__stem-hitbox');
    this.petalHitboxes = Object.fromEntries(
      PETAL_KEYS.map((key) => [key, this.makeHitbox(flowerEl, 'flower-game__petal-hitbox')])
    );

    this.bindStem();
    for (const key of PETAL_KEYS) this.bindPetal(key);

    this.sizeFlower();
    this.positionCaption();
    this.sizeHitboxes();
    this.applyFlowerTransform();
    window.addEventListener('resize', this.resizeHandler);
  }

  makeHitbox(parent, className) {
    const hitbox = document.createElement('div');
    hitbox.className = className;
    parent.appendChild(hitbox);
    return hitbox;
  }

  centerOf(bbox) {
    return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
  }

  unionBBox(elements) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of elements) {
      const b = el.getBBox();
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  applyFlowerTransform() {
    const { x, y } = this.dragOffset;
    this.flowerEl.style.transform = `translate(calc(-50% + ${x}px), ${y}px)`;
  }

  // Picking up the stem (or leaf) lets the whole flower follow that finger
  // around the screen, like it's been pulled loose from the ground.
  bindStem() {
    const handleDown = (event) => {
      if (this.falling || this.stemHeld) return;
      this.stemHeld = true;
      this.stemPointerId = event.pointerId;
      this.dragStartClient = { x: event.clientX, y: event.clientY };
      this.dragStartOffset = { ...this.dragOffset };
      this.flowerEl.style.transition = 'none';
    };
    const handleMove = (event) => {
      if (event.pointerId !== this.stemPointerId) return;
      this.dragOffset = {
        x: this.dragStartOffset.x + (event.clientX - this.dragStartClient.x),
        y: this.dragStartOffset.y + (event.clientY - this.dragStartClient.y),
      };
      this.applyFlowerTransform();
    };
    const handleUp = (event) => {
      if (event.pointerId !== this.stemPointerId) return;
      this.stemHeld = false;
      this.stemPointerId = null;
      if (!this.won) this.triggerFail();
    };

    this.stemHitbox.addEventListener('pointerdown', handleDown);
    this.stemHitbox.addEventListener('pointermove', handleMove);
    this.stemHitbox.addEventListener('pointerup', handleUp);
    this.stemHitbox.addEventListener('pointercancel', handleUp);
    this.unbindFns.push(() => {
      this.stemHitbox.removeEventListener('pointerdown', handleDown);
      this.stemHitbox.removeEventListener('pointermove', handleMove);
      this.stemHitbox.removeEventListener('pointerup', handleUp);
      this.stemHitbox.removeEventListener('pointercancel', handleUp);
    });
  }

  // Any touch on a petal - the second touch and every one after it - tracks
  // that finger 1:1 while held; it only actually plucks (and continues
  // drifting/fading in the same direction) once the finger releases.
  bindPetal(key) {
    const hitbox = this.petalHitboxes[key];
    const petal = this.petals[key];
    const handleDown = (event) => {
      if (this.falling || !this.stemHeld || this.removedPetals.has(key)) return;
      if (event.pointerId === this.stemPointerId) return;
      if (this.petalPointers.has(key)) return;
      this.petalPointers.set(key, event.pointerId);
      this.petalDragStart[key] = { x: event.clientX, y: event.clientY };
      petal.style.transition = 'none';
    };
    const handleMove = (event) => {
      if (this.petalPointers.get(key) !== event.pointerId) return;
      const start = this.petalDragStart[key];
      const dx = (event.clientX - start.x) / this.renderScale;
      const dy = (event.clientY - start.y) / this.renderScale;
      petal.setAttribute('transform', `translate(${dx}, ${dy})`);
    };
    const handleUp = (event) => {
      if (this.petalPointers.get(key) !== event.pointerId) return;
      this.petalPointers.delete(key);
      if (!this.removedPetals.has(key)) this.removePetal(key, event);
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
  }

  // A petal is only actually plucked once the finger touching it lifts, per
  // Jonathan's spec. It continues on in whatever direction it was just being
  // dragged (a real pull-and-release feel); a release with little or no drag
  // (a plain tap) falls back to the petal's own outward-from-bud direction.
  removePetal(key, releaseEvent) {
    this.removedPetals.add(key);
    this.petalHitboxes[key].style.pointerEvents = 'none';

    const start = this.petalDragStart[key];
    const dx = (releaseEvent.clientX - start.x) / this.renderScale;
    const dy = (releaseEvent.clientY - start.y) / this.renderScale;
    const dragLen = Math.sqrt(dx * dx + dy * dy);

    let dirX;
    let dirY;
    let lift = 0;
    if (dragLen > MIN_DRAG_LEN) {
      dirX = dx / dragLen;
      dirY = dy / dragLen;
    } else {
      ({ x: dirX, y: dirY } = this.petalDirections[key]);
      lift = PETAL_LIFT_PX;
    }

    const finalX = dx + dirX * PETAL_FLOAT_DIST;
    const finalY = dy + dirY * PETAL_FLOAT_DIST - lift;
    this.petals[key].style.transition = `transform ${PETAL_FADE_MS}ms ease-out, opacity ${PETAL_FADE_MS}ms ease-out`;
    this.petals[key].setAttribute('transform', `translate(${finalX}, ${finalY})`);
    this.petals[key].style.opacity = '0';

    this.pluckedCount++;
    if (this.pluckedCount >= PETAL_KEYS.length) {
      this.won = true;
      setTimeout(() => this.onComplete(), PETAL_FADE_MS);
    }
  }

  // Letting go of the stem before all petals are gone drops the whole flower
  // (falling further from wherever it currently was, not snapping back to
  // center first); after a beat, a fresh flower grows back up into the same
  // original spot and play can start over.
  triggerFail() {
    if (this.falling) return;
    this.falling = true;
    this.flowerEl.style.pointerEvents = 'none';
    this.petalPointers.clear();

    this.flowerEl.style.transition = `transform ${FALL_MS}ms ease-in, opacity ${FALL_MS}ms ease-in`;
    this.dragOffset = { x: this.dragOffset.x, y: this.dragOffset.y + DROP_DISTANCE_PX };
    this.applyFlowerTransform();
    this.flowerEl.style.opacity = '0';

    this.fallTimer = setTimeout(() => {
      this.resetPetals();

      // Reposition (invisible, off-screen) directly below the original
      // spot, so growth always rises back up in the same place regardless
      // of where the flower had been dragged to when it fell.
      this.dragOffset = { x: 0, y: DROP_DISTANCE_PX };
      this.flowerEl.style.transition = 'none';
      this.applyFlowerTransform();
      this.flowerEl.getBoundingClientRect(); // flush before re-enabling the transition in grow()

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
    this.dragOffset = { x: 0, y: 0 };
    this.applyFlowerTransform();

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
    this.renderScale = renderedWidth / FLOWER_VIEWBOX.width;
    this.sizeHitbox(this.stemHitbox, this.stemBBox, STEM_HITBOX_PADDING_PX);
    for (const key of PETAL_KEYS) {
      this.sizeHitbox(this.petalHitboxes[key], this.petalBBoxes[key], PETAL_HITBOX_PADDING_PX);
    }
  }

  sizeHitbox(hitbox, bbox, paddingPx) {
    const center = this.centerOf(bbox);
    hitbox.style.width = `${bbox.width * this.renderScale + paddingPx * 2}px`;
    hitbox.style.height = `${bbox.height * this.renderScale + paddingPx * 2}px`;
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
