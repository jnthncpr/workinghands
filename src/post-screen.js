import { loadInlineSVG } from './svg-loader.js';

const BLINK_MS = 250; // choppy snap, no easing — matches the ants' dance-frame cadence

// Shared "you did it" interstitial shown after a game's win condition,
// before the sequencer advances. background/icon/message/nextActiveIcon are
// per-game; onNext is called when the player taps through.
// Returns a cleanup function — callers must invoke it whenever the screen
// goes away (e.g. from their own destroy()), since it owns a running timer.
export function showPostScreen(container, { background, icon, message, nextActiveIcon, onNext }) {
  container.innerHTML = '';

  const screen = document.createElement('div');
  screen.className = 'post-screen';
  screen.style.setProperty('--post-bg', background);
  container.appendChild(screen);

  const iconEl = document.createElement('div');
  iconEl.className = 'post-screen__icon';
  iconEl.textContent = icon;
  screen.appendChild(iconEl);

  let tilted = false;
  iconEl.style.transform = 'rotate(-15deg)';
  const blinkTimer = setInterval(() => {
    tilted = !tilted;
    iconEl.style.transform = `rotate(${tilted ? 15 : -15}deg)`;
  }, BLINK_MS);

  const messageEl = document.createElement('p');
  messageEl.className = 'post-screen__message';
  messageEl.textContent = message;
  screen.appendChild(messageEl);

  // Two stacked layers toggled via display (not swapped/replaced), same
  // safe pattern as the play button — replacing DOM content mid-interaction
  // was breaking native click dispatch on desktop.
  const nextButton = document.createElement('button');
  nextButton.className = 'post-screen__next';
  screen.appendChild(nextButton);

  const nextRest = document.createElement('div');
  nextRest.className = 'post-screen__next-rest';
  nextButton.appendChild(nextRest);
  loadInlineSVG('Assets/SVG/next.svg', nextRest);

  const nextActive = document.createElement('div');
  nextActive.className = 'post-screen__next-active';
  nextActive.style.display = 'none';
  nextButton.appendChild(nextActive);
  loadInlineSVG(nextActiveIcon, nextActive);

  const setPressed = (pressed) => {
    nextRest.style.display = pressed ? 'none' : '';
    nextActive.style.display = pressed ? '' : 'none';
  };
  nextButton.addEventListener('pointerenter', () => setPressed(true));
  nextButton.addEventListener('pointerdown', () => setPressed(true));
  nextButton.addEventListener('pointerleave', () => setPressed(false));
  nextButton.addEventListener('pointerup', () => setPressed(false));
  nextButton.addEventListener('pointercancel', () => setPressed(false));
  nextButton.addEventListener('click', onNext);

  return () => clearInterval(blinkTimer);
}
