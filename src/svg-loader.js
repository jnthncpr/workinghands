const markupCache = new Map();

function fetchMarkup(path) {
  if (!markupCache.has(path)) {
    markupCache.set(path, fetch(path).then((response) => response.text()));
  }
  return markupCache.get(path);
}

// Parses simple flat "selector { prop: value; ... }" blocks directly from
// CSS text. Deliberately not using styleEl.sheet.cssRules here: older WebKit
// (confirmed on iOS 15 / iPad Air 2) doesn't reliably populate a freshly
// inserted <style> tag's CSSOM synchronously, so reading .sheet right after
// insertion can silently see nothing there — and since the style tag gets
// removed regardless, that failure mode is silent (default black fills)
// rather than a visible error. Text parsing has no such timing dependency.
function parseFlatCSS(cssText) {
  const rules = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = ruleRe.exec(cssText))) {
    const selectors = match[1].trim();
    const declarations = match[2]
      .split(';')
      .map((decl) => decl.trim())
      .filter(Boolean)
      .map((decl) => {
        const i = decl.indexOf(':');
        return [decl.slice(0, i).trim(), decl.slice(i + 1).trim()];
      });
    if (selectors && declarations.length) rules.push({ selectors, declarations });
  }
  return rules;
}

// Illustrator exports reuse generic class names (.cls-1, .cls-2, ...) across
// files. Inlining several SVGs into one document makes their <style> blocks
// collide globally, so bake each rule's declarations onto matching elements
// as inline styles, then drop the <style> tag before it can leak further.
function scopeStyles(root) {
  for (const styleEl of root.querySelectorAll('style')) {
    for (const { selectors, declarations } of parseFlatCSS(styleEl.textContent)) {
      for (const selector of selectors.split(',')) {
        for (const el of root.querySelectorAll(selector.trim())) {
          for (const [prop, value] of declarations) {
            el.style.setProperty(prop, value);
          }
        }
      }
    }
    styleEl.remove();
  }
  return root;
}

// Illustrator/Figma exports of multi-state rigs don't hide their non-rest
// groups by default (that's a manual per-asset step that's easy to miss), so
// every group renders stacked on top of each other until told otherwise.
// Passing { states, initial } establishes a clean single-state render as
// soon as the SVG lands, instead of leaving that as a separate call site can
// forget to make.
export async function loadInlineSVG(path, container, { states, initial } = {}) {
  const markup = await fetchMarkup(path);
  container.insertAdjacentHTML('beforeend', markup);
  const root = scopeStyles(container.lastElementChild);
  if (states && initial) setState(root, states, initial);
  return root;
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
