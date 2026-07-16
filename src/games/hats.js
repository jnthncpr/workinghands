import { loadInlineSVG } from '../svg-loader.js';

export class Hats {
  static label = 'Hats';

  constructor(container, { onComplete }) {
    this.container = container;
    this.onComplete = onComplete;
    this.handleAdvance = this.handleAdvance.bind(this);
  }

  async mount() {
    // placeholder asset — game likely cycles pigeon/goat/frog hat groups, TBD
    this.root = await loadInlineSVG('Assets/SVG/pigeon_hat_group.svg', this.container);
    this.container.addEventListener('click', this.handleAdvance);
  }

  handleAdvance() {
    this.onComplete();
  }

  destroy() {
    this.container.removeEventListener('click', this.handleAdvance);
  }
}
