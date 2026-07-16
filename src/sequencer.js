export class Sequencer {
  constructor({ stage, nav, games }) {
    this.stage = stage;
    this.nav = nav;
    this.games = games;
    this.index = 0;
    this.current = null;
  }

  start() {
    this.mount(0);
  }

  mount(index) {
    this.current?.destroy?.();
    this.stage.replaceChildren();
    this.stage.className = ''; // each game's mount() adds its own class; start every game with a clean slate
    this.index = Math.max(0, Math.min(index, this.games.length - 1));
    const GameClass = this.games[this.index];
    this.nav.style.setProperty('--nav-color', GameClass.navColor || '#222');
    this.current = new GameClass(this.stage, { onComplete: () => this.next() });
    this.current.mount();
    this.updateNav();
  }

  next() {
    if (this.index + 1 < this.games.length) this.mount(this.index + 1);
  }

  back() {
    if (this.index > 0) this.mount(this.index - 1);
  }

  skip() {
    this.next();
  }

  updateNav() {
    this.nav.querySelector('[data-action="back"]').disabled = this.index === 0;
    this.nav.querySelector('[data-action="skip"]').disabled = this.index === this.games.length - 1;
  }
}
