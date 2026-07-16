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

// no dedicated "back" icon asset yet — using a plain text pill as a placeholder
backButton.textContent = 'back';

await Promise.all([
  loadInlineSVG('Assets/SVG/home_play.svg', playButton),
  loadInlineSVG('Assets/SVG/next.svg', skipButton),
]);

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
