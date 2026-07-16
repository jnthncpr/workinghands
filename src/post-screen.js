// Shared "you did it" interstitial shown after a game's win condition,
// before the sequencer advances. background/icon/message are per-game;
// onNext is called when the player taps through.
export function showPostScreen(container, { background, icon, message, onNext }) {
  container.innerHTML = '';

  const screen = document.createElement('div');
  screen.className = 'post-screen';
  screen.style.setProperty('--post-bg', background);
  container.appendChild(screen);

  const iconEl = document.createElement('div');
  iconEl.className = 'post-screen__icon';
  iconEl.textContent = icon;
  screen.appendChild(iconEl);

  const messageEl = document.createElement('p');
  messageEl.className = 'post-screen__message';
  messageEl.textContent = message;
  screen.appendChild(messageEl);

  const nextButton = document.createElement('button');
  nextButton.className = 'post-screen__next';
  nextButton.textContent = 'next';
  nextButton.addEventListener('click', onNext);
  screen.appendChild(nextButton);

  return screen;
}
