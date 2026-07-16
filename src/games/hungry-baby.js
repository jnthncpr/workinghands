import { loadInlineSVG } from '../svg-loader.js';
import { bindPressZone } from '../gesture.js';
import { bindDraggable } from '../drag.js';

const BABY_VIEWBOX = { width: 384, height: 388.92 };

const FOODS = [
  { key: 'broccoli', path: 'Assets/SVG/baby_broccoli.svg', width: 149, height: 137 },
  { key: 'chicken', path: 'Assets/SVG/baby_chicken.svg', width: 99, height: 218 },
  { key: 'tomato', path: 'Assets/SVG/baby_tomato.svg', width: 126, height: 104 },
];

export class HungryBaby {
  static label = 'Hungry Baby';
  static navColor = '#fdf3be';

  constructor(container, { onComplete }) {
    this.container = container;
    this.onComplete = onComplete;
    this.mouthOpen = false;
    this.fedCount = 0;
    this.unbindFns = [];
    this.resizeHandler = () => {
      this.sizeBaby();
      this.positionCaption();
    };
  }

  async mount() {
    this.container.classList.add('hungry-baby');

    const foodsRow = document.createElement('div');
    foodsRow.className = 'hungry-baby__foods';
    this.container.appendChild(foodsRow);
    this.foodsRow = foodsRow;

    for (const food of FOODS) {
      const slot = document.createElement('div');
      slot.className = 'hungry-baby__food';
      slot.style.width = `${food.width}px`;
      slot.style.height = `${food.height}px`;
      foodsRow.appendChild(slot);
      await loadInlineSVG(food.path, slot);
      this.bindFood(slot);
    }

    const caption = document.createElement('p');
    caption.className = 'hungry-baby__caption';
    caption.textContent = "feed the baby! he's hungry!";
    this.container.appendChild(caption);
    this.caption = caption;

    const baby = document.createElement('div');
    baby.className = 'hungry-baby__baby';
    this.container.appendChild(baby);
    this.baby = baby;

    this.mouthZone = document.createElement('div');
    this.mouthZone.className = 'hungry-baby__mouth-zone';
    baby.appendChild(this.mouthZone);

    this.babyRest = document.createElement('div');
    this.babyRest.className = 'baby-visual';
    baby.appendChild(this.babyRest);
    await loadInlineSVG('Assets/SVG/baby_rest.svg', this.babyRest);

    this.babyOpen = document.createElement('div');
    this.babyOpen.className = 'baby-visual';
    this.babyOpen.style.display = 'none';
    baby.appendChild(this.babyOpen);
    await loadInlineSVG('Assets/SVG/baby_open.svg', this.babyOpen);

    const unbindPress = bindPressZone(baby, {
      onPress: () => this.setMouthOpen(true),
      onRelease: () => this.setMouthOpen(false),
    });
    this.unbindFns.push(unbindPress);

    this.sizeBaby();
    this.positionCaption();
    window.addEventListener('resize', this.resizeHandler);
  }

  // baby-visual layers are position:absolute (so toggling which is visible
  // can't collapse the container's layout — see the play-button hover fix),
  // which means nothing establishes .hungry-baby__baby's own height. Its
  // width is responsive (CSS), so the height is derived here from the SVG's
  // fixed aspect ratio rather than relying on CSS aspect-ratio support.
  sizeBaby() {
    const width = this.baby.getBoundingClientRect().width;
    this.baby.style.height = `${width * (BABY_VIEWBOX.height / BABY_VIEWBOX.width)}px`;
  }

  // Positions the caption at the exact vertical midpoint between the foods
  // row and the baby, measured directly rather than assumed, since both are
  // independently positioned (foods pinned near the top, baby pinned to the
  // bottom) and the gap between them varies with viewport height.
  positionCaption() {
    const foodsBottom = this.foodsRow.getBoundingClientRect().bottom;
    const babyTop = this.baby.getBoundingClientRect().top;
    const containerTop = this.container.getBoundingClientRect().top;
    const midpoint = (foodsBottom + babyTop) / 2 - containerTop;
    this.caption.style.top = `${midpoint}px`;
  }

  setMouthOpen(open) {
    this.mouthOpen = open;
    this.babyRest.style.display = open ? 'none' : '';
    this.babyOpen.style.display = open ? '' : 'none';
  }

  bindFood(slot) {
    let origin = { left: 0, top: 0 };

    const unbind = bindDraggable(slot, {
      onDragStart: () => {
        const rect = slot.getBoundingClientRect();
        origin = { left: rect.left, top: rect.top };
        slot.style.position = 'fixed';
        slot.style.left = `${origin.left}px`;
        slot.style.top = `${origin.top}px`;
        slot.style.margin = '0';
        slot.style.zIndex = '10';
      },
      onDragMove: (event, dx, dy) => {
        slot.style.left = `${origin.left + dx}px`;
        slot.style.top = `${origin.top + dy}px`;
      },
      onDragEnd: () => {
        const foodRect = slot.getBoundingClientRect();
        const centerX = foodRect.left + foodRect.width / 2;
        const centerY = foodRect.top + foodRect.height / 2;
        const mouthRect = this.mouthZone.getBoundingClientRect();
        const inMouth =
          this.mouthOpen &&
          centerX >= mouthRect.left &&
          centerX <= mouthRect.right &&
          centerY >= mouthRect.top &&
          centerY <= mouthRect.bottom;

        if (inMouth) {
          this.feed(slot, unbind);
        } else {
          slot.style.left = `${origin.left}px`;
          slot.style.top = `${origin.top}px`;
        }
      },
    });

    this.unbindFns.push(unbind);
  }

  feed(slot, unbind) {
    unbind();
    slot.style.transition = 'opacity 150ms';
    slot.style.opacity = '0';
    setTimeout(() => slot.remove(), 150);

    this.fedCount++;
    if (this.fedCount >= FOODS.length) {
      this.onComplete();
    }
  }

  destroy() {
    window.removeEventListener('resize', this.resizeHandler);
    for (const unbind of this.unbindFns) unbind();
  }
}
