import { loadInlineSVG } from '../svg-loader.js';

const ANIMALS = [
  { key: 'goat', path: 'Assets/SVG/goat_hat_group.svg' },
  { key: 'pigeon', path: 'Assets/SVG/pigeon_hat_group.svg' },
  { key: 'frog', path: 'Assets/SVG/frog_hat_group.svg' },
];

const CONTAINER_WIDTH_FRACTION = 0.7; // fraction of a column's width each hat/animal window fills
const HITBOX_PADDING_PX = 40;
const ANIMAL_LOAD_FRACTION = 0.82; // animals start ~18% closer to center than the full clamp distance - on-phone testing found them starting too low otherwise
const SNAP_FRACTION = 0.25; // once both are within this fraction of D from dead center, they snap the rest of the way together - reaching the exact clamp boundary with two fingers at once may not be physically achievable for every player
const SNAP_MS = 150;

export class Hats {
  static label = 'Hats';
  static navColor = '#222';

  constructor(container, { onComplete }) {
    this.container = container;
    this.onComplete = onComplete;
    this.unbindFns = [];
    this.pairs = {};
    this.resizeHandler = () => {
      this.sizeAll();
      this.positionCaption();
    };
  }

  async mount() {
    this.container.classList.add('hats-game');

    const caption = document.createElement('p');
    caption.className = 'hats-game__caption';
    caption.textContent = 'put hats on heads!';
    this.container.appendChild(caption);
    this.caption = caption;

    const row = document.createElement('div');
    row.className = 'hats-game__row';
    this.container.appendChild(row);
    this.row = row;

    for (const animal of ANIMALS) {
      await this.loadPair(animal);
    }

    this.sizeAll();
    this.positionCaption();
    window.addEventListener('resize', this.resizeHandler);
  }

  // Loads the same combined animal+hat artwork twice into two separate
  // windows - one with the animal group hidden (leaving just the hat), one
  // with the hat group hidden (leaving just the animal). Both windows keep
  // the file's own native viewBox untouched, so they share the exact same
  // coordinate mapping - meaning when both windows are centered on top of
  // each other (both offsets at 0), the hat and animal land back in their
  // original, correctly-drawn relative alignment (hat on head) automatically.
  async loadPair({ key, path }) {
    const column = document.createElement('div');
    column.className = 'hats-game__column';
    this.row.appendChild(column);

    const hatEl = document.createElement('div');
    hatEl.className = 'hats-game__hat';
    column.appendChild(hatEl);
    const hatHitbox = document.createElement('div');
    hatHitbox.className = 'hats-game__hitbox';
    hatEl.appendChild(hatHitbox);

    const animalEl = document.createElement('div');
    animalEl.className = 'hats-game__animal';
    column.appendChild(animalEl);
    const animalHitbox = document.createElement('div');
    animalHitbox.className = 'hats-game__hitbox';
    animalEl.appendChild(animalHitbox);

    const hatRoot = await loadInlineSVG(path, hatEl);
    const animalInHatRoot = hatRoot.querySelector(`#${key}`);
    const hatInHatRoot = hatRoot.querySelector(`#${key}_hat`);
    const animalBBox = animalInHatRoot.getBBox();
    const hatBBox = hatInHatRoot.getBBox();
    const nativeViewBox = {
      width: hatRoot.viewBox.baseVal.width,
      height: hatRoot.viewBox.baseVal.height,
    };
    animalInHatRoot.style.display = 'none';

    const animalRoot = await loadInlineSVG(path, animalEl);
    animalRoot.querySelector(`#${key}_hat`).style.display = 'none';

    const pair = {
      hatEl,
      animalEl,
      hatHitbox,
      animalHitbox,
      hatBBox,
      animalBBox,
      nativeViewBox,
      nativeAspect: nativeViewBox.height / nativeViewBox.width,
      hatOffset: 0,
      animalOffset: 0,
      D: null,
      hatPointerId: null,
      animalPointerId: null,
      hatLastClientY: null,
      animalLastClientY: null,
      pinchBaseline: null,
      won: false,
    };
    this.pairs[key] = pair;
    this.bindPinch(key);
  }

  bindPinch(key) {
    const pair = this.pairs[key];

    const hatDown = (event) => {
      if (pair.won || pair.hatPointerId !== null) return;
      pair.hatPointerId = event.pointerId;
      pair.hatLastClientY = event.clientY;
      this.maybeStartPinch(key);
    };
    const hatMove = (event) => {
      if (event.pointerId !== pair.hatPointerId) return;
      pair.hatLastClientY = event.clientY;
      this.updatePinch(key);
    };
    const hatUp = (event) => {
      if (event.pointerId !== pair.hatPointerId) return;
      pair.hatPointerId = null;
      pair.pinchBaseline = null;
    };

    const animalDown = (event) => {
      if (pair.won || pair.animalPointerId !== null) return;
      pair.animalPointerId = event.pointerId;
      pair.animalLastClientY = event.clientY;
      this.maybeStartPinch(key);
    };
    const animalMove = (event) => {
      if (event.pointerId !== pair.animalPointerId) return;
      pair.animalLastClientY = event.clientY;
      this.updatePinch(key);
    };
    const animalUp = (event) => {
      if (event.pointerId !== pair.animalPointerId) return;
      pair.animalPointerId = null;
      pair.pinchBaseline = null;
    };

    pair.hatHitbox.addEventListener('pointerdown', hatDown);
    pair.hatHitbox.addEventListener('pointermove', hatMove);
    pair.hatHitbox.addEventListener('pointerup', hatUp);
    pair.hatHitbox.addEventListener('pointercancel', hatUp);
    pair.animalHitbox.addEventListener('pointerdown', animalDown);
    pair.animalHitbox.addEventListener('pointermove', animalMove);
    pair.animalHitbox.addEventListener('pointerup', animalUp);
    pair.animalHitbox.addEventListener('pointercancel', animalUp);

    this.unbindFns.push(() => {
      pair.hatHitbox.removeEventListener('pointerdown', hatDown);
      pair.hatHitbox.removeEventListener('pointermove', hatMove);
      pair.hatHitbox.removeEventListener('pointerup', hatUp);
      pair.hatHitbox.removeEventListener('pointercancel', hatUp);
      pair.animalHitbox.removeEventListener('pointerdown', animalDown);
      pair.animalHitbox.removeEventListener('pointermove', animalMove);
      pair.animalHitbox.removeEventListener('pointerup', animalUp);
      pair.animalHitbox.removeEventListener('pointercancel', animalUp);
    });
  }

  // A pinch only starts once both the hat and the animal are actively held -
  // per Jonathan's call, neither moves on its own from a single finger.
  maybeStartPinch(key) {
    const pair = this.pairs[key];
    if (pair.hatPointerId !== null && pair.animalPointerId !== null && !pair.pinchBaseline) {
      pair.pinchBaseline = {
        hatY: pair.hatLastClientY,
        hatOffset: pair.hatOffset,
        animalY: pair.animalLastClientY,
        animalOffset: pair.animalOffset,
      };
    }
  }

  updatePinch(key) {
    const pair = this.pairs[key];
    // Once snapped, a pair is locked in place - a finger left down through
    // the snap (it happens mid-drag, before anyone's necessarily lifted)
    // shouldn't be able to pull it back apart with further movement.
    if (pair.won) return;
    if (!pair.pinchBaseline) {
      this.maybeStartPinch(key);
      return;
    }
    const hatDelta = pair.hatLastClientY - pair.pinchBaseline.hatY;
    const animalDelta = pair.animalLastClientY - pair.pinchBaseline.animalY;
    // Clamped to [-D, 0] for the hat and [0, D] for the animal - each can
    // reach the shared center line but never cross past it, so the two can
    // only ever meet exactly in the middle, per Jonathan's spec.
    pair.hatOffset = Math.max(-pair.D, Math.min(0, pair.pinchBaseline.hatOffset + hatDelta));
    pair.animalOffset = Math.max(0, Math.min(pair.D, pair.pinchBaseline.animalOffset + animalDelta));

    const snapThreshold = pair.D * SNAP_FRACTION;
    if (Math.abs(pair.hatOffset) <= snapThreshold && Math.abs(pair.animalOffset) <= snapThreshold) {
      this.snapTogether(key);
      return;
    }

    this.applyOffset(key, 'hat');
    this.applyOffset(key, 'animal');
  }

  applyOffset(key, which) {
    const pair = this.pairs[key];
    const el = which === 'hat' ? pair.hatEl : pair.animalEl;
    const offset = which === 'hat' ? pair.hatOffset : pair.animalOffset;
    el.style.transform = `translate(-50%, calc(-50% + ${offset}px))`;
  }

  // Getting exactly to the clamp boundary with two fingers moving at once
  // may not be physically achievable for every player, so once both are
  // close enough, finish the job for them with a quick snap into place.
  snapTogether(key) {
    const pair = this.pairs[key];
    pair.hatOffset = 0;
    pair.animalOffset = 0;
    pair.hatEl.style.transition = `transform ${SNAP_MS}ms ease-out`;
    pair.animalEl.style.transition = `transform ${SNAP_MS}ms ease-out`;
    this.applyOffset(key, 'hat');
    this.applyOffset(key, 'animal');
    setTimeout(() => {
      pair.hatEl.style.transition = '';
      pair.animalEl.style.transition = '';
    }, SNAP_MS);

    pair.won = true;
    if (Object.values(this.pairs).every((p) => p.won)) {
      this.onComplete();
    }
  }

  // D (each element's max travel toward center) is half the row's height, so
  // a hat dragged fully down and an animal dragged fully up land at exactly
  // the same point - the row's own vertical center - reproducing "aligned
  // right in the middle of the page" without needing precise aim.
  sizeAll() {
    const rowRect = this.row.getBoundingClientRect();
    const newD = rowRect.height / 2;
    const columnWidth = rowRect.width / ANIMALS.length;

    for (const { key } of ANIMALS) {
      const pair = this.pairs[key];
      const isFirstSizing = pair.D === null;
      const wasAtLoad =
        !isFirstSizing &&
        pair.pinchBaseline === null &&
        pair.hatOffset === -pair.D &&
        pair.animalOffset === pair.D * ANIMAL_LOAD_FRACTION;
      pair.D = newD;

      if (isFirstSizing || wasAtLoad) {
        pair.hatOffset = -newD;
        pair.animalOffset = newD * ANIMAL_LOAD_FRACTION;
      } else {
        pair.hatOffset = Math.max(-newD, Math.min(0, pair.hatOffset));
        pair.animalOffset = Math.max(0, Math.min(newD, pair.animalOffset));
      }
      this.applyOffset(key, 'hat');
      this.applyOffset(key, 'animal');

      // Dual-constrained (same reasoning as the bear/baby's sizing): the
      // shared window spans the whole animal+hat composition, which can be
      // considerably taller than it is wide, so width-only sizing could
      // produce a box so tall that, centered right at the row's edge, half
      // of it pokes up past the row into the caption's gap.
      const maxWidth = columnWidth * CONTAINER_WIDTH_FRACTION;
      const maxHeight = Math.min(140, newD * 0.5);
      let width = maxWidth;
      let height = width * pair.nativeAspect;
      if (height > maxHeight) {
        height = maxHeight;
        width = height / pair.nativeAspect;
      }
      pair.hatEl.style.width = `${width}px`;
      pair.hatEl.style.height = `${height}px`;
      pair.animalEl.style.width = `${width}px`;
      pair.animalEl.style.height = `${height}px`;

      this.sizeHitbox(pair.hatHitbox, pair.hatEl, pair.hatBBox, pair.nativeViewBox);
      this.sizeHitbox(pair.animalHitbox, pair.animalEl, pair.animalBBox, pair.nativeViewBox);
    }
  }

  // Sized/positioned from each group's own bbox (mapped as a % of the shared
  // native viewBox) rather than the window's full box, so the hat and animal
  // hitboxes stay reasonably distinct even as the two windows converge and
  // overlap near the win position.
  sizeHitbox(hitbox, containerEl, bbox, nativeViewBox) {
    const renderedWidth = containerEl.getBoundingClientRect().width;
    const scale = renderedWidth / nativeViewBox.width;
    const center = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
    hitbox.style.width = `${bbox.width * scale + HITBOX_PADDING_PX * 2}px`;
    hitbox.style.height = `${bbox.height * scale + HITBOX_PADDING_PX * 2}px`;
    hitbox.style.left = `${(center.x / nativeViewBox.width) * 100}%`;
    hitbox.style.top = `${(center.y / nativeViewBox.height) * 100}%`;
  }

  // Centers the caption in the gap between the nav and the row's top edge
  // (where the hats sit at load).
  positionCaption() {
    const rowTop = this.row.getBoundingClientRect().top;
    const containerTop = this.container.getBoundingClientRect().top;
    const midpoint = (rowTop - containerTop) / 2;
    this.caption.style.top = `${midpoint}px`;
  }

  destroy() {
    window.removeEventListener('resize', this.resizeHandler);
    for (const unbind of this.unbindFns) unbind();
  }
}
