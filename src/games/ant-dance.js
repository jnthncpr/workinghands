import { loadInlineSVG } from '../svg-loader.js';

export class AntDance {
  static label = 'Ant Dance';

  constructor(container, { onComplete }) {
    this.container = container;
    this.onComplete = onComplete;
    this.handleAdvance = this.handleAdvance.bind(this);
  }

  async mount() {
    this.root = await loadInlineSVG('Assets/SVG/ant_rest.svg', this.container);
    // placeholder advance until the real gesture is wired up
    this.container.addEventListener('click', this.handleAdvance);
  }

  handleAdvance() {
    this.onComplete();
  }

  destroy() {
    this.container.removeEventListener('click', this.handleAdvance);
  }
}
