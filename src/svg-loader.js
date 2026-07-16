const markupCache = new Map();

function fetchMarkup(path) {
  if (!markupCache.has(path)) {
    markupCache.set(path, fetch(path).then((response) => response.text()));
  }
  return markupCache.get(path);
}

// Illustrator exports reuse generic class names (.cls-1, .cls-2, ...) across
// files. Inlining several SVGs into one document makes their <style> blocks
// collide globally, so bake each rule's declarations onto matching elements
// as inline styles, then drop the <style> tag before it can leak further.
function scopeStyles(root) {
  for (const styleEl of root.querySelectorAll('style')) {
    const sheet = styleEl.sheet;
    if (sheet) {
      for (const rule of sheet.cssRules) {
        if (!rule.style) continue;
        for (const el of root.querySelectorAll(rule.selectorText)) {
          for (const prop of rule.style) {
            el.style.setProperty(prop, rule.style.getPropertyValue(prop));
          }
        }
      }
    }
    styleEl.remove();
  }
  return root;
}

export async function loadInlineSVG(path, container) {
  const markup = await fetchMarkup(path);
  container.insertAdjacentHTML('beforeend', markup);
  return scopeStyles(container.lastElementChild);
}

export async function replaceInlineSVG(path, container) {
  const markup = await fetchMarkup(path);
  container.innerHTML = markup;
  return scopeStyles(container.firstElementChild);
}

export function setState(svgRoot, stateGroupIds, activeId) {
  for (const id of stateGroupIds) {
    const el = svgRoot.querySelector(`#${id}`);
    if (el) el.style.display = id === activeId ? '' : 'none';
  }
}
