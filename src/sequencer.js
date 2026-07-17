export class Sequencer {
  constructor({ stage, nav, games, onFinish }) {
    this.stage = stage;
    this.nav = nav;
    this.games = games;
    this.onFinish = onFinish;
    this.index = 0;
    this.current = null;
    this.mounting = false;
  }

  start() {
    this.mount(0);
  }

  mount(index) {
    // Guards against a real race: mount() is async per-game (awaits SVG
    // loads), and without this a rapid-tap on back/skip could clear the
    // stage for a new game while the previous game's mount() is still
    // mid-flight — it would then keep appending its own content onto the
    // new game's stage once its awaited fetch finally resolves. Disabling
    // nav until the current mount settles removes the window for that.
    this.current?.destroy?.();
    this.stage.replaceChildren();
    this.stage.className = ''; // each game's mount() adds its own class; start every game with a clean slate
    this.index = Math.max(0, Math.min(index, this.games.length - 1));
    const GameClass = this.games[this.index];
    this.nav.style.setProperty('--nav-color', GameClass.navColor || '#222');
    this.current = new GameClass(this.stage, { onComplete: () => this.next() });

    this.mounting = true;
    this.updateNav();
    Promise.resolve(this.current.mount()).then(() => {
      this.mounting = false;
      this.updateNav();
    });
  }

  next() {
    if (this.index + 1 < this.games.length) {
      this.mount(this.index + 1);
    } else {
      this.current?.destroy?.();
      this.current = null;
      this.onFinish?.();
    }
  }

  back() {
    if (this.index > 0) this.mount(this.index - 1);
  }

  skip() {
    this.next();
  }

  updateNav() {
    this.nav.querySelector('[data-action="back"]').disabled = this.mounting || this.index === 0;
    this.nav.querySelector('[data-action="skip"]').disabled = this.mounting || this.index === this.games.length - 1;
  }
}
