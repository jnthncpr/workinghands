import { Sequencer } from './sequencer.js';
import { loadInlineSVG } from './svg-loader.js';
import { AntDance } from './games/ant-dance.js';
import { HungryBaby } from './games/hungry-baby.js';
import { BearScratch } from './games/bear-scratch.js';
import { Smiley } from './games/smiley.js';
import { Flower } from './games/flower.js';
import { Hats } from './games/hats.js';

const home = document.getElementById('home');
const stage = document.getElementById('stage');
const nav = document.getElementById('nav');
const playButton = document.getElementById('play-button');
const backButton = nav.querySelector('[data-action="back"]');
const skipButton = nav.querySelector('[data-action="skip"]');

backButton.textContent = 'back';
skipButton.textContent = 'skip';

// iOS Safari only unlocks Web Audio inside the call stack of a genuine user
// gesture. Doing this on the very first touch anywhere (rather than lazily
// inside each game's first note) gives the browser the earliest, most
// direct gesture to unlock against.
document.addEventListener(
  'pointerdown',
  () => {
    if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
      Tone.start();
    }
  },
  { once: true }
);

// touch-action:none on html/body should already block double-tap-to-zoom,
// but older Safari versions don't reliably honor that — this is a
// belt-and-suspenders fallback using the classic fast-tap-detection pattern.
let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  },
  { passive: false }
);

// Both states load once as stacked layers, toggled via display — swapping
// the button's DOM content on every hover/press (e.g. via innerHTML
// replacement) was breaking the browser's native click dispatch on desktop,
// since mousedown/mouseup need to resolve to a stable target across the
// interaction.
const playRest = document.createElement('div');
playRest.className = 'play-visual';
playButton.appendChild(playRest);
await loadInlineSVG('Assets/SVG/home_play.svg', playRest);

const playActive = document.createElement('div');
playActive.className = 'play-visual';
playButton.appendChild(playActive);
await loadInlineSVG('Assets/SVG/home_play_active.svg', playActive);

const setPlayActive = (active) => {
  playRest.style.display = active ? 'none' : '';
  playActive.style.display = active ? '' : 'none';
};
setPlayActive(false);

playButton.addEventListener('pointerenter', () => setPlayActive(true));
playButton.addEventListener('pointerdown', () => setPlayActive(true));
playButton.addEventListener('pointerleave', () => setPlayActive(false));
playButton.addEventListener('pointerup', () => setPlayActive(false));
playButton.addEventListener('pointercancel', () => setPlayActive(false));

const sequencer = new Sequencer({
  stage,
  nav,
  games: [AntDance, HungryBaby, BearScratch, Smiley, Flower, Hats],
});

playButton.addEventListener('click', () => {
  home.hidden = true;
  stage.hidden = false;
  nav.hidden = false;
  sequencer.start();
});

backButton.addEventListener('click', () => sequencer.back());
skipButton.addEventListener('click', () => sequencer.skip());
