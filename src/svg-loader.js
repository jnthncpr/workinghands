export async function loadInlineSVG(path, container) {
  const response = await fetch(path);
  const markup = await response.text();
  container.insertAdjacentHTML('beforeend', markup);
  return container.lastElementChild;
}

export function setState(svgRoot, stateGroupIds, activeId) {
  for (const id of stateGroupIds) {
    const el = svgRoot.querySelector(`#${id}`);
    if (el) el.style.display = id === activeId ? '' : 'none';
  }
}
